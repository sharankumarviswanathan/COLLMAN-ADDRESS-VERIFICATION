const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.TEST_DB_PATH || process.env.DB_PATH || path.join(__dirname, 'collman_bgv.db');
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
      { name: 'document_back_original_name', type: 'TEXT' },
      { name: 'joint_selfie_captured', type: 'INTEGER DEFAULT 0' },
      { name: 'joint_selfie_path', type: 'TEXT' },
      { name: 'joint_selfie_latitude', type: 'REAL' },
      { name: 'joint_selfie_longitude', type: 'REAL' },
      { name: 'joint_selfie_accuracy', type: 'REAL' },
      { name: 'joint_selfie_captured_at', type: 'TEXT' },
      { name: 'joint_selfie_tl_id', type: 'TEXT' },
      { name: 'joint_selfie_tl_name', type: 'TEXT' }
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
    const needsMigration = !veCols.includes('latitude') || !currentVeSql.includes('door_photo') || !currentVeSql.includes('joint_selfie');

    if (needsMigration) {
      console.log('Migrating verification_evidence table...');
      await query.exec(`
        CREATE TABLE IF NOT EXISTS verification_evidence_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id INTEGER,
          attempt_number INTEGER NOT NULL DEFAULT 1,
          employee_id TEXT NOT NULL,
          evidence_type TEXT NOT NULL CHECK(evidence_type IN ('selfie', 'house_photo', 'building_photo', 'entrance_photo', 'street_photo', 'landmark_photo', 'door_photo', 'address_proof', 'joint_selfie')),
          document_type TEXT,
          file_path TEXT NOT NULL,
          original_filename TEXT,
          mime_type TEXT,
          file_size INTEGER,
          latitude REAL,
          longitude REAL,
          gps_accuracy REAL,
          captured_at TEXT DEFAULT CURRENT_TIMESTAMP,
          validation_status TEXT DEFAULT 'PASSED',
          validation_report TEXT,
          validated_at TEXT,
          tl_id TEXT,
          tl_name TEXT
        );
      `);

      const commonCols = ['id', 'case_id', 'attempt_number', 'employee_id', 'evidence_type', 'document_type', 'file_path', 'original_filename', 'mime_type', 'file_size', 'latitude', 'longitude', 'gps_accuracy', 'captured_at', 'validation_status', 'validation_report', 'validated_at', 'tl_id', 'tl_name'];
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

    // 3. Ensure validation tracking & TL columns in verification_evidence
    const finalVeCols = (await query.all('PRAGMA table_info(verification_evidence)')).map((c) => c.name);
    const expectedVeCols = [
      { name: 'validation_status', type: 'TEXT DEFAULT "PASSED"' },
      { name: 'validation_report', type: 'TEXT' },
      { name: 'validated_at', type: 'TEXT' },
      { name: 'tl_id', type: 'TEXT' },
      { name: 'tl_name', type: 'TEXT' }
    ];

    for (const col of expectedVeCols) {
      if (!finalVeCols.includes(col.name)) {
        await query.run(`ALTER TABLE verification_evidence ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Added column verification_evidence.${col.name}`);
      }
    }

    // 4. Ensure users table allows optional email
    const usersTableInfo = await query.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
    if (usersTableInfo && usersTableInfo.sql && (usersTableInfo.sql.includes('email TEXT UNIQUE NOT NULL') || usersTableInfo.sql.includes('email TEXT NOT NULL'))) {
      const uCols = (await query.all('PRAGMA table_info(users)')).map((c) => c.name);
      const hasManager = uCols.includes('manager');
      try {
        await query.exec('PRAGMA foreign_keys = OFF;');
        await query.exec(`
          CREATE TABLE IF NOT EXISTS users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL,
            branch TEXT,
            department TEXT,
            manager TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );

          INSERT INTO users_new (id, username, email, password_hash, full_name, role, branch, department${hasManager ? ', manager' : ''}, is_active, created_at, updated_at)
          SELECT id, username, email, password_hash, full_name, role, branch, department${hasManager ? ', manager' : ''}, is_active, created_at, updated_at FROM users;

          DROP TABLE users;
          ALTER TABLE users_new RENAME TO users;

          CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL AND email != '';
        `);
        console.log('Migrated users table to allow optional email.');
      } finally {
        await query.exec('PRAGMA foreign_keys = ON;');
      }
    }

    // 5. Ensure roles and role_permissions tables exist
    await query.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name TEXT UNIQUE NOT NULL,
        role_code TEXT UNIQUE NOT NULL,
        description TEXT,
        badge_color TEXT DEFAULT 'purple',
        is_system INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name TEXT NOT NULL,
        permission_key TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_name, permission_key)
      );
    `);

    // 5. Seed default roles and permissions if missing
    try {
      const { DEFAULT_ROLES, DEFAULT_ROLE_PERMISSIONS } = require('../utils/permissions');
      for (const r of DEFAULT_ROLES) {
        const existing = await query.get('SELECT id FROM roles WHERE role_name = ?', [r.role_name]);
        if (!existing) {
          await query.run(
            `INSERT INTO roles (role_name, role_code, description, badge_color, is_system, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [r.role_name, r.role_code, r.description, r.badge_color, r.is_system]
          );
          console.log(`Seeded default role: ${r.role_name}`);
        }

        const defaultPerms = DEFAULT_ROLE_PERMISSIONS[r.role_name] || [];
        for (const p of defaultPerms) {
          await query.run(
            'INSERT OR IGNORE INTO role_permissions (role_name, permission_key) VALUES (?, ?)',
            [r.role_name, p]
          );
        }
      }
    } catch (permErr) {
      console.warn('Warning during default roles seeding:', permErr.message);
    }

    // 6. Migrate users table to remove CHECK(role IN (...)) constraint if present
    const userTableSqlRow = await query.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
    if (userTableSqlRow && userTableSqlRow.sql && (userTableSqlRow.sql.includes('CHECK(role IN') || userTableSqlRow.sql.includes('CHECK (role IN'))) {
      console.log('Migrating users table to support dynamic and custom roles...');
      const uCols = (await query.all('PRAGMA table_info(users)')).map((c) => c.name);
      const hasManager = uCols.includes('manager');
      try {
        await query.exec('PRAGMA foreign_keys = OFF;');
        await query.exec(`
          CREATE TABLE users_ext (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL,
            branch TEXT,
            department TEXT,
            manager TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO users_ext (id, username, email, password_hash, full_name, role, branch, department${hasManager ? ', manager' : ''}, is_active, created_at, updated_at)
          SELECT id, username, email, password_hash, full_name, role, branch, department${hasManager ? ', manager' : ''}, is_active, created_at, updated_at FROM users;
          DROP TABLE users;
          ALTER TABLE users_ext RENAME TO users;

          CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL AND email != '';
        `);
        console.log('Migrated users table successfully.');
      } finally {
        await query.exec('PRAGMA foreign_keys = ON;');
      }
    }

    // 7. Ensure employees table has team_leader column
    const empCols = (await query.all('PRAGMA table_info(employees)')).map((c) => c.name);
    if (!empCols.includes('team_leader')) {
      await query.run('ALTER TABLE employees ADD COLUMN team_leader TEXT');
      console.log('Added column employees.team_leader');
    }

    // 8. Ensure users table has manager column
    const usrCols = (await query.all('PRAGMA table_info(users)')).map((c) => c.name);
    if (!usrCols.includes('manager')) {
      await query.run('ALTER TABLE users ADD COLUMN manager TEXT');
      console.log('Added column users.manager');
    }

    // 9. Ensure tl_id and agent_id tracking columns exist across verification and audit tables
    const auditCols = (await query.all('PRAGMA table_info(audit_logs)')).map((c) => c.name);
    if (!auditCols.includes('tl_id')) {
      await query.run('ALTER TABLE audit_logs ADD COLUMN tl_id TEXT');
      console.log('Added column audit_logs.tl_id');
    }
    if (!auditCols.includes('agent_id')) {
      await query.run('ALTER TABLE audit_logs ADD COLUMN agent_id TEXT');
      console.log('Added column audit_logs.agent_id');
    }

    const progCols = (await query.all('PRAGMA table_info(verification_progress)')).map((c) => c.name);
    if (!progCols.includes('tl_id')) {
      await query.run('ALTER TABLE verification_progress ADD COLUMN tl_id TEXT');
      console.log('Added column verification_progress.tl_id');
    }
    if (!progCols.includes('tl_name')) {
      await query.run('ALTER TABLE verification_progress ADD COLUMN tl_name TEXT');
      console.log('Added column verification_progress.tl_name');
    }

    const caseCols = (await query.all('PRAGMA table_info(verification_cases)')).map((c) => c.name);
    if (!caseCols.includes('tl_id')) {
      await query.run('ALTER TABLE verification_cases ADD COLUMN tl_id TEXT');
      console.log('Added column verification_cases.tl_id');
    }
    if (!caseCols.includes('tl_name')) {
      await query.run('ALTER TABLE verification_cases ADD COLUMN tl_name TEXT');
      console.log('Added column verification_cases.tl_name');
    }

    const attemptCols = (await query.all('PRAGMA table_info(verification_attempts)')).map((c) => c.name);
    if (!attemptCols.includes('tl_id')) {
      await query.run('ALTER TABLE verification_attempts ADD COLUMN tl_id TEXT');
      console.log('Added column verification_attempts.tl_id');
    }
    if (!attemptCols.includes('tl_name')) {
      await query.run('ALTER TABLE verification_attempts ADD COLUMN tl_name TEXT');
      console.log('Added column verification_attempts.tl_name');
    }

    const timelineCols = (await query.all('PRAGMA table_info(verification_timeline)')).map((c) => c.name);
    if (!timelineCols.includes('tl_id')) {
      await query.run('ALTER TABLE verification_timeline ADD COLUMN tl_id TEXT');
      console.log('Added column verification_timeline.tl_id');
    }

    // 10. Ensure designations master table exists and is populated
    await query.exec(`
      CREATE TABLE IF NOT EXISTS designations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        designation_code TEXT UNIQUE NOT NULL,
        designation_name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const desigCount = await query.get('SELECT COUNT(*) as count FROM designations');
    if ((desigCount?.count || 0) === 0) {
      const initialDesignations = [
        { code: 'EXE', name: 'Executive', description: 'Core operations & verification executive' },
        { code: 'FOE', name: 'Field Operations Executive', description: 'On-ground field verification & operations' },
        { code: 'SOE', name: 'Senior Operations Executive', description: 'Senior operations & verification analysis' },
        { code: 'SSE', name: 'Senior Software Engineer', description: 'Software engineering & platform development' },
        { code: 'OE', name: 'Operations Executive', description: 'Operations & workflow processing' },
        { code: 'SS', name: 'Support Specialist', description: 'Customer & partner support specialist' },
        { code: 'BA', name: 'BGV Analyst', description: 'Background verification case analyst' },
        { code: 'ACC', name: 'Accountant', description: 'Finance & account processing' },
        { code: 'OL', name: 'Operations Lead', description: 'Operations leadership & coordination' },
        { code: 'HRE', name: 'HR Executive', description: 'Human resources management & onboarding' }
      ];

      for (const d of initialDesignations) {
        await query.run(
          `INSERT OR IGNORE INTO designations (designation_code, designation_name, description, is_active)
           VALUES (?, ?, ?, 1)`,
          [d.code, d.name, d.description]
        );
      }
      console.log('Seeded initial designations.');
    }

    // Ensure all distinct designations present in employees are also in designations master
    const existingInEmployees = await query.all(
      'SELECT DISTINCT designation FROM employees WHERE designation IS NOT NULL AND TRIM(designation) != ""'
    );
    for (const empDesig of existingInEmployees) {
      const name = empDesig.designation.trim();
      const exists = await query.get('SELECT id FROM designations WHERE LOWER(designation_name) = LOWER(?)', [name]);
      if (!exists) {
        const autoCode = name.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase() || 'DES';
        await query.run(
          'INSERT OR IGNORE INTO designations (designation_code, designation_name, is_active) VALUES (?, ?, 1)',
          [autoCode, name]
        );
        console.log(`Synchronized designation '${name}' from existing employee records.`);
      }
    }

    // 11. Ensure locations table has branch_id column and proper branch relationships
    const locCols = (await query.all('PRAGMA table_info(locations)')).map((c) => c.name);
    if (!locCols.includes('branch_id')) {
      await query.run('ALTER TABLE locations ADD COLUMN branch_id INTEGER');
      console.log('Added column locations.branch_id');
    }
    if (!locCols.includes('created_at')) {
      await query.run('ALTER TABLE locations ADD COLUMN created_at TEXT');
    }
    if (!locCols.includes('updated_at')) {
      await query.run('ALTER TABLE locations ADD COLUMN updated_at TEXT');
    }
    await query.exec('CREATE INDEX IF NOT EXISTS idx_locations_branch_id ON locations(branch_id);');

    // Deduplicate exact duplicate rows in locations (e.g., from repetitive seeds)
    await query.exec(`
      DELETE FROM locations
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM locations
        GROUP BY LOWER(TRIM(location_name)), LOWER(TRIM(COALESCE(city, ''))), LOWER(TRIM(COALESCE(state, ''))), COALESCE(branch_id, 0)
      );
    `);

    // Associate unlinked locations with branches where city/state matches
    const allBranches = await query.all('SELECT id, branch_code, branch_name, city, state FROM branches');
    for (const b of allBranches) {
      await query.run(
        `UPDATE locations
         SET branch_id = ?
         WHERE branch_id IS NULL
           AND (
             LOWER(TRIM(city)) = LOWER(TRIM(?))
             OR LOWER(TRIM(location_name)) LIKE '%' || LOWER(TRIM(?)) || '%'
             OR LOWER(TRIM(?)) LIKE '%' || LOWER(TRIM(city)) || '%'
           )`,
        [b.id, b.city, b.branch_name, b.branch_name]
      );
    }

    // Specific Bangalore requirement: Bangalore Central, Whitefield, Electronic City
    const blrBranch = allBranches.find(b => b.branch_code === 'BGL' || b.branch_name.toUpperCase() === 'BANGALORE');
    if (blrBranch) {
      const blrLocs = [
        { name: 'Bangalore Central', city: 'BANGALORE', state: 'KARNATAKA' },
        { name: 'Whitefield', city: 'BANGALORE', state: 'KARNATAKA' },
        { name: 'Electronic City', city: 'BANGALORE', state: 'KARNATAKA' }
      ];
      for (const loc of blrLocs) {
        const exists = await query.get(
          'SELECT id FROM locations WHERE branch_id = ? AND LOWER(TRIM(location_name)) = LOWER(TRIM(?))',
          [blrBranch.id, loc.name]
        );
        if (!exists) {
          await query.run(
            'INSERT INTO locations (branch_id, location_name, city, state, is_active) VALUES (?, ?, ?, ?, 1)',
            [blrBranch.id, loc.name, loc.city, loc.state]
          );
        }
      }
    }

    // Specific Chennai requirement: ensure Chennai Central, Mount Road, Guindy
    const chnBranch = allBranches.find(b => b.branch_code === 'CHN' || b.branch_name.toUpperCase() === 'CHENNAI');
    if (chnBranch) {
      const chnLocs = [
        { name: 'Chennai Central', city: 'Chennai', state: 'Tamil Nadu' },
        { name: 'Mount Road', city: 'Chennai', state: 'Tamil Nadu' },
        { name: 'Guindy', city: 'Chennai', state: 'Tamil Nadu' }
      ];
      for (const loc of chnLocs) {
        const exists = await query.get(
          'SELECT id FROM locations WHERE branch_id = ? AND LOWER(TRIM(location_name)) = LOWER(TRIM(?))',
          [chnBranch.id, loc.name]
        );
        if (!exists) {
          await query.run(
            'INSERT INTO locations (branch_id, location_name, city, state, is_active) VALUES (?, ?, ?, ?, 1)',
            [chnBranch.id, loc.name, loc.city, loc.state]
          );
        }
      }
    }


  } catch (err) {
    console.error('Error initializing database schema:', err);
    throw err;
  }
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = {
  db,
  query,
  initDatabase,
  closeDatabase,
  DB_PATH
};
