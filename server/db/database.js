const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'collman_bgv.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure upload & download directories exist
const uploadDir = path.join(__dirname, '..', 'uploads');
const downloadDir = path.join(__dirname, '..', 'downloads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
  }
});

// Promisified database helpers
const query = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  exec: (sql) => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

// Initialize schema & migrate tables if needed
async function initDatabase() {
  try {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    await query.exec(schemaSql);
    console.log('Database schema verified and loaded.');

    // 1. Check and add missing columns to verification_progress
    const vpCols = (await query.all('PRAGMA table_info(verification_progress)')).map((c) => c.name);
    const expectedVpCols = [
      { name: 'selfie_latitude', type: 'REAL' },
      { name: 'selfie_longitude', type: 'REAL' },
      { name: 'selfie_accuracy', type: 'REAL' },
      { name: 'selfie_captured_at', type: 'TEXT' },
      { name: 'house_photo_latitude', type: 'REAL' },
      { name: 'house_photo_longitude', type: 'REAL' },
      { name: 'house_photo_accuracy', type: 'REAL' },
      { name: 'house_photo_captured_at', type: 'TEXT' },
      { name: 'street_photo_captured', type: 'INTEGER DEFAULT 0' },
      { name: 'street_photo_path', type: 'TEXT' },
      { name: 'street_photo_latitude', type: 'REAL' },
      { name: 'street_photo_longitude', type: 'REAL' },
      { name: 'street_photo_accuracy', type: 'REAL' },
      { name: 'street_photo_captured_at', type: 'TEXT' },
      { name: 'landmark_photo_captured', type: 'INTEGER DEFAULT 0' },
      { name: 'landmark_photo_path', type: 'TEXT' },
      { name: 'landmark_photo_latitude', type: 'REAL' },
      { name: 'landmark_photo_longitude', type: 'REAL' },
      { name: 'landmark_photo_accuracy', type: 'REAL' },
      { name: 'landmark_photo_captured_at', type: 'TEXT' },
      { name: 'door_photo_captured', type: 'INTEGER DEFAULT 0' },
      { name: 'door_photo_path', type: 'TEXT' },
      { name: 'door_photo_latitude', type: 'REAL' },
      { name: 'door_photo_longitude', type: 'REAL' },
      { name: 'door_photo_accuracy', type: 'REAL' },
      { name: 'door_photo_captured_at', type: 'TEXT' },
      { name: 'document_back_path', type: 'TEXT' },
      { name: 'document_back_original_name', type: 'TEXT' }
    ];

    for (const col of expectedVpCols) {
      if (!vpCols.includes(col.name)) {
        await query.run(`ALTER TABLE verification_progress ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Added column verification_progress.${col.name}`);
      }
    }

    // 2. Check and migrate verification_evidence if necessary
    const veCols = (await query.all('PRAGMA table_info(verification_evidence)')).map((c) => c.name);
    const veCreateSqlRow = await query.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='verification_evidence'");
    const currentVeSql = veCreateSqlRow?.sql || '';
    const needsMigration = !veCols.includes('latitude') || !currentVeSql.includes('door_photo');

    if (needsMigration) {
      console.log('Migrating verification_evidence table...');
      await query.exec(`
        CREATE TABLE IF NOT EXISTS verification_evidence_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id INTEGER,
          attempt_number INTEGER NOT NULL DEFAULT 1,
          employee_id TEXT NOT NULL,
          evidence_type TEXT NOT NULL CHECK(evidence_type IN ('selfie', 'house_photo', 'building_photo', 'entrance_photo', 'street_photo', 'landmark_photo', 'door_photo', 'address_proof')),
          document_type TEXT,
          file_path TEXT NOT NULL,
          original_filename TEXT,
          mime_type TEXT,
          file_size INTEGER,
          latitude REAL,
          longitude REAL,
          gps_accuracy REAL,
          captured_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const commonCols = ['id', 'case_id', 'attempt_number', 'employee_id', 'evidence_type', 'document_type', 'file_path', 'original_filename', 'mime_type', 'file_size', 'captured_at'];
      const copyCols = commonCols.filter((c) => veCols.includes(c)).join(', ');
      if (copyCols.length > 0) {
        await query.exec(`
          INSERT INTO verification_evidence_new (${copyCols})
          SELECT ${copyCols} FROM verification_evidence;
        `);
      }

      await query.exec(`
        DROP TABLE verification_evidence;
        ALTER TABLE verification_evidence_new RENAME TO verification_evidence;
        CREATE INDEX IF NOT EXISTS idx_evidence_emp_id ON verification_evidence(employee_id);
      `);
      console.log('Migrated verification_evidence successfully.');
    }

    // 3. Ensure validation tracking columns in verification_evidence
    const finalVeCols = (await query.all('PRAGMA table_info(verification_evidence)')).map((c) => c.name);
    const expectedVeCols = [
      { name: 'validation_status', type: 'TEXT DEFAULT "PASSED"' },
      { name: 'validation_report', type: 'TEXT' },
      { name: 'validated_at', type: 'TEXT' }
    ];

    for (const col of expectedVeCols) {
      if (!finalVeCols.includes(col.name)) {
        await query.run(`ALTER TABLE verification_evidence ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Added column verification_evidence.${col.name}`);
      }
    }
  } catch (err) {
    console.error('Error initializing database schema:', err);
    throw err;
  }
}

module.exports = {
  db,
  query,
  initDatabase,
  DB_PATH
};
