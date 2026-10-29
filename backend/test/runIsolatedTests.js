/**
 * Isolated Test Runner for GSD Phase 1 — Plan 1.1 (All 19 Test Suites)
 * - Executes all 19 test suites in 3 distinct deterministic tiers
 * - Tier 1: Pure Unit Tests (strictPhotoValidationRules, googleGeocoding)
 * - Tier 2: Direct Database Tests (photoEvidenceCoords, reverificationAndStrictLifecycle, imageValidationAnd5Photos, doorPhotoCoordsReview, generateMultiPageReport)
 * - Tier 3: HTTP Server Integration Tests (api, branchLocationHierarchy, designationMaster, mastersCrud, managerTlDependency, optionalEmailUser, rolesAndPermissions, test_permissions_verification, test_perms, zeroLocationBranch, employeeCrud, userEdit)
 * - Initializes unique temporary SQLite DB via isolated seed subprocess and Plan 1.1 fixture seeder
 * - Redirects PDF and map generation to isolated TEST_DOWNLOADS_DIR
 * - Validates port 5099 availability before server startup
 * - Spawns test server on isolated port 5099 inheriting TEST_DB_PATH and TEST_DOWNLOADS_DIR
 * - Polls /api/health with stdout/stderr error capture and unconditional timer cleanup
 * - Immediate registration of all child processes into a single trackedProcesses registry
 * - Permanent error and exit listeners prevent unhandled EventEmitter errors post-timeout
 * - Decouples spawn/runtime errors from termination: only 'exit'/'close' confirms termination
 * - Unstarted processes (no PID) tracked separately from started processes
 * - Exception-safe teardown: unexpected errors caught, logged, and set non-zero exit code
 * - Preserves temporary DB, auxiliary files, and downloads if any started process remains unconfirmed
 * - Deletes temporary files only after every started process is confirmed stopped
 * - Reports individual PASS/FAIL/SKIPPED results for all 19 suites
 * - Explicitly sets process.exitCode = isSuccess ? 0 : 1
 */

const { spawn, exec } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');

const TEST_PORT = 5099;
const SERVER_ENTRY = path.join(__dirname, '..', 'index.js');
const SEED_SCRIPT = path.join(__dirname, '..', 'db', 'seed.js');

// Unique temporary database and downloads directory for this specific test run
const uniqueId = `isolated_test_${Date.now()}_${process.pid}_${Math.random().toString(36).substring(2, 8)}`;
const tempDbPath = path.join(__dirname, '..', 'db', `${uniqueId}.db`);
const tempDownloadsDir = path.join(__dirname, '..', 'downloads', `temp_test_downloads_${uniqueId}`);

// Auxiliary files specifically bound to this unique database
const targetAuxiliaryFiles = [
  tempDbPath,
  `${tempDbPath}-wal`,
  `${tempDbPath}-shm`,
  `${tempDbPath}-journal`,
];

// Single shared registry for every child process spawned in this test run
const trackedProcesses = [];
const suiteResults = [];

function checkPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use by another process. Cannot start isolated test server.`));
      } else {
        reject(err);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve());
    });
    server.listen(port, '127.0.0.1');
  });
}

function registerProcess(proc, name) {
  const hasPid = Boolean(proc && proc.pid);

  const entry = {
    proc,
    name,
    pid: proc ? proc.pid : null,
    started: hasPid,          // True only if an OS process was actually spawned
    spawnError: null,         // Captured if a spawn failure or error occurs
    confirmedStopped: false,  // True only when confirmed exited or never started
    exitCode: null,
    signalCode: null,
    terminationError: null,
  };

  // If no process object or no PID exists, it never started and requires no termination
  if (!proc || !hasPid) {
    entry.started = false;
    entry.confirmedStopped = true;
    trackedProcesses.push(entry);
    return entry;
  }

  // Persistent exit listeners that are NEVER removed:
  // For any process that actually started, confirmedStopped is ONLY set true
  // by the OS-delivered 'exit' or 'close' events.
  const markStopped = (code, signal) => {
    entry.confirmedStopped = true;
    entry.exitCode = code;
    entry.signalCode = signal;
  };

  proc.once('exit', markStopped);
  proc.once('close', markStopped);

  // Permanent error handler:
  // Stays active throughout the full process lifecycle so an error emitted
  // during or after timeout can NEVER become an unhandled EventEmitter error.
  // CRITICAL: An error event does NOT mark a started process as stopped.
  proc.on('error', (err) => {
    entry.spawnError = err.message;
    if (!proc.pid) {
      entry.started = false;
      entry.confirmedStopped = true;
    }
  });

  if (proc.exitCode !== null || proc.signalCode !== null) {
    entry.confirmedStopped = true;
    entry.exitCode = proc.exitCode;
    entry.signalCode = proc.signalCode;
  }

  trackedProcesses.push(entry);
  return entry;
}

function terminateProcess(entry, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const { proc, name, pid, started } = entry;

    // If it never started or already confirmed stopped, resolve immediately
    if (!started || entry.confirmedStopped || (proc && (proc.exitCode !== null || proc.signalCode !== null))) {
      entry.confirmedStopped = true;
      return resolve();
    }

    if (!proc || !pid) {
      entry.confirmedStopped = true;
      return resolve();
    }

    let timer = null;
    let settled = false;

    // Temporary listener specifically for this termination attempt
    const onConfirmedExit = () => {
      if (!settled) {
        settled = true;
        if (timer) clearTimeout(timer);
        proc.removeListener('exit', onConfirmedExit);
        proc.removeListener('close', onConfirmedExit);
        entry.confirmedStopped = true;
        resolve();
      }
    };

    proc.once('exit', onConfirmedExit);
    proc.once('close', onConfirmedExit);

    timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.removeListener('exit', onConfirmedExit);
        proc.removeListener('close', onConfirmedExit);
        const errMsg = `Process ${name} (PID: ${pid}) failed to confirm exit within ${timeoutMs}ms.`;
        entry.terminationError = errMsg;
        reject(new Error(errMsg));
      }
    }, timeoutMs);

    // Dispatch OS kill command
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${pid} /T /F`, () => {
          // Resolution is exclusively governed by exit/close events
        });
      } else {
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!entry.confirmedStopped && proc.exitCode === null && proc.signalCode === null) {
            proc.kill('SIGKILL');
          }
        }, 2000);
      }
    } catch (err) {
      // If signal dispatching threw, timer will reject if not stopped
    }
  });
}

function runSubprocess(scriptPath, env, options = {}) {
  const { timeoutMs = 25000, captureOutput = false, name = path.basename(scriptPath) } = options;

  let stdout = '';
  let stderr = '';
  let childProc = null;
  let entry = null;
  const startTime = Date.now();

  try {
    childProc = spawn(process.execPath, [scriptPath], {
      env,
      stdio: captureOutput ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    });
    entry = registerProcess(childProc, name);
  } catch (err) {
    entry = registerProcess(null, name);
    entry.spawnError = err.message;
    return {
      proc: null,
      entry,
      promise: Promise.resolve({
        success: false,
        code: -1,
        stdout: '',
        stderr: `Failed to spawn process: ${err.message}`,
        timedOut: false,
        durationMs: Date.now() - startTime,
      }),
    };
  }

  if (captureOutput) {
    if (childProc.stdout) childProc.stdout.on('data', (d) => { stdout += d.toString(); });
    if (childProc.stderr) childProc.stderr.on('data', (d) => { stderr += d.toString(); });
  }

  const promise = new Promise((resolve) => {
    let timer = null;
    let settled = false;

    const onComplete = (code, signal) => {
      if (!settled) {
        settled = true;
        if (timer) clearTimeout(timer);
        childProc.removeListener('close', onComplete);
        childProc.removeListener('exit', onComplete);
        childProc.removeListener('error', onStepError);
        resolve({
          success: code === 0,
          code,
          signal,
          stdout,
          stderr,
          timedOut: false,
          durationMs: Date.now() - startTime,
        });
      }
    };

    const onStepError = async (err) => {
      if (!settled) {
        settled = true;
        if (timer) clearTimeout(timer);
        childProc.removeListener('close', onComplete);
        childProc.removeListener('exit', onComplete);
        childProc.removeListener('error', onStepError);

        if (entry.started && !entry.confirmedStopped) {
          try {
            await terminateProcess(entry, 5000);
          } catch (_) {}
        }

        resolve({
          success: false,
          code: -1,
          stdout,
          stderr: err.message,
          timedOut: false,
          durationMs: Date.now() - startTime,
        });
      }
    };

    childProc.once('close', onComplete);
    childProc.once('exit', onComplete);
    childProc.on('error', onStepError);

    timer = setTimeout(async () => {
      if (!settled) {
        settled = true;
        // Clean up step-specific listeners; permanent proc.on('error') in registerProcess remains active!
        childProc.removeListener('close', onComplete);
        childProc.removeListener('exit', onComplete);
        childProc.removeListener('error', onStepError);

        console.error(`\n[TIMEOUT] Subprocess [${name}] (PID: ${entry.pid}) timed out after ${timeoutMs}ms. Attempting termination...`);

        let termError = '';
        try {
          await terminateProcess(entry, 6000);
        } catch (tErr) {
          termError = tErr.message;
        }

        // Process remains registered in trackedProcesses.
        // entry.confirmedStopped accurately reflects whether it actually exited or not.
        resolve({
          success: false,
          code: -1,
          stdout,
          stderr: `Process timed out after ${timeoutMs}ms.${termError ? ` Termination failed: ${termError}` : ''}`,
          timedOut: true,
          durationMs: Date.now() - startTime,
        });
      }
    }, timeoutMs);
  });

  return { proc: childProc, entry, promise };
}

function waitForServer(serverProc, port, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let timer = null;
    let pollInterval = null;
    let settled = false;

    let serverStderr = '';
    let serverStdout = '';

    const onStdout = (data) => { serverStdout += data.toString(); };
    const onStderr = (data) => { serverStderr += data.toString(); };

    serverProc.stdout.on('data', onStdout);
    serverProc.stderr.on('data', onStderr);

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (pollInterval) clearInterval(pollInterval);
      serverProc.removeListener('exit', onEarlyExit);
      serverProc.removeListener('error', onServerStartError);
    };

    const onServerStartError = (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`Server process failed to spawn: ${err.message}`));
      }
    };

    const onEarlyExit = (code, signal) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(
          `Server process exited prematurely with code ${code} (signal: ${signal}).\n` +
          `[SERVER STDERR]:\n${serverStderr.trim() || '(empty)'}\n` +
          `[SERVER STDOUT]:\n${serverStdout.trim() || '(empty)'}`
        ));
      }
    };

    serverProc.on('error', onServerStartError);
    serverProc.once('exit', onEarlyExit);

    timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(
          `Server health check timed out after ${timeoutMs}ms on port ${port}.\n` +
          `[SERVER STDERR]:\n${serverStderr.trim() || '(empty)'}\n` +
          `[SERVER STDOUT]:\n${serverStdout.trim() || '(empty)'}`
        ));
      }
    }, timeoutMs);

    const checkHealth = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          if (!settled) {
            settled = true;
            cleanup();
            resolve();
          }
        }
      });
      req.on('error', () => {
        // Retry until timeout or premature exit
      });
      req.end();
    };

    pollInterval = setInterval(checkHealth, 300);
    checkHealth();
  });
}

/**
 * Baseline Fixtures for Plan 1.1 Tests
 * Seeds managers, team leaders, employee 202140, case AV-2026-000003, and photo evidence
 * into the temporary database. Explicitly closes db connection to avoid file locks.
 */
async function seedPlan11Fixtures(dbFilePath) {
  const sqlite3 = require('sqlite3').verbose();
  const bcrypt = require('bcryptjs');
  const db = new sqlite3.Database(dbFilePath);

  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

  const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  try {
    const pwHash = await bcrypt.hash('password123', 10);

    // 1. Managers for managerTlDependency.test.js
    await run(`
      INSERT INTO users (username, full_name, role, email, password_hash, branch, department, is_active)
      VALUES 
        ('11134', 'ARUN CINCO', 'MANAGER', 'arun.cinco@collman.com', ?, 'Chennai Headquarters', 'Operations', 1),
        ('10011', 'SARANGAN SAMPATH', 'MANAGER', 'sarangan.sampath@collman.com', ?, 'Chennai Headquarters', 'Operations', 1),
        ('10571', 'BALAJI SHANKAR', 'MANAGER', 'balaji.shankar@collman.com', ?, 'Chennai Headquarters', 'Operations', 1)
    `, [pwHash, pwHash, pwHash]);

    // 2. Team Leader 202140 (Surya)
    await run(`
      INSERT INTO users (username, full_name, role, email, password_hash, manager, branch, department, is_active)
      VALUES ('202140', 'Surya', 'Team Leader', 'surya.tl@collman.com', ?, 'SARANGAN SAMPATH', 'Chennai Headquarters', 'Operations', 1)
    `, [pwHash]);

    // 3. 5 Team Leaders for ARUN CINCO
    await run(`
      INSERT INTO users (username, full_name, role, email, password_hash, manager, branch, department, is_active)
      VALUES
        ('tl_manikandan', 'MANIKANDAN K', 'Team Leader', 'manikandan@collman.com', ?, 'ARUN CINCO', 'Chennai Headquarters', 'Operations', 1),
        ('tl_madhu', 'T J MADHU', 'Team Leader', 'madhu@collman.com', ?, 'ARUN CINCO', 'Chennai Headquarters', 'Operations', 1),
        ('tl_gurudevi', 'ULLAGANTI GURU DEVI', 'Team Leader', 'gurudevi@collman.com', ?, 'ARUN CINCO', 'Chennai Headquarters', 'Operations', 1),
        ('tl_aravindan', 'ARAVINDAN R', 'Team Leader', 'aravindan@collman.com', ?, 'ARUN CINCO', 'Chennai Headquarters', 'Operations', 1),
        ('tl_karthick', 'M. KARTHICK', 'Team Leader', 'karthick@collman.com', ?, 'ARUN CINCO', 'Chennai Headquarters', 'Operations', 1)
    `, [pwHash, pwHash, pwHash, pwHash, pwHash]);

    // 4. 2 Additional Team Leaders for SARANGAN SAMPATH (total 3 including 202140)
    await run(`
      INSERT INTO users (username, full_name, role, email, password_hash, manager, branch, department, is_active)
      VALUES
        ('tl_arulmani', 'ARULMANI T', 'Team Leader', 'arulmani@collman.com', ?, 'SARANGAN SAMPATH', 'Chennai Headquarters', 'Operations', 1),
        ('tl_three', 'TL Three', 'Team Leader', 'tl3@collman.com', ?, 'SARANGAN SAMPATH', 'Chennai Headquarters', 'Operations', 1)
    `, [pwHash, pwHash]);

    // 5. 10 Team Leaders for BALAJI SHANKAR
    for (let i = 1; i <= 10; i++) {
      await run(`
        INSERT INTO users (username, full_name, role, email, password_hash, manager, branch, department, is_active)
        VALUES (?, ?, 'Team Leader', ?, ?, 'BALAJI SHANKAR', 'Chennai Headquarters', 'Operations', 1)
      `, [`tl_balaji_${i}`, `TL Balaji ${i}`, `balaji_tl${i}@collman.com`, pwHash]);
    }

    // Resolve reviewer1 ID dynamically
    const revUser = await get("SELECT id FROM users WHERE username = 'reviewer1'");
    const reviewerId = revUser?.id || 3;

    // 6. Employee 202140
    await run(`
      INSERT INTO employees (
        employee_id, employee_name, mobile_number, alt_mobile_number, email_id, date_of_joining,
        department, designation, branch, location, reporting_manager, team_leader,
        hr_current_address, hr_address_line1, hr_address_line2, hr_area, hr_landmark,
        hr_city, hr_district, hr_state, hr_pincode, hr_permanent_address, hr_permanent_pincode,
        hr_latitude, hr_longitude, verification_status, assigned_reviewer_id, created_by
      ) VALUES (
        '202140', 'Surya', '9840123456', '9840123457', 'surya.k@collman.com', '2024-01-15',
        'Operations', 'Team Leader', 'Chennai Headquarters', 'Chennai Central', 'SARANGAN SAMPATH', 'Surya',
        'No 12, Gandhi Street, T Nagar, Chennai - 600017', 'No 12, Gandhi Street', 'T Nagar', 'T Nagar', 'Near Bus Stand',
        'Chennai', 'Chennai', 'Tamil Nadu', '600017', 'Same as current', '600017',
        13.079000, 80.199016, 'Pending BGV Review', ?, 'HR'
      )
    `, [reviewerId]);

    // 7. Verification Case AV-2026-000003
    await run(`
      INSERT INTO verification_cases (
        case_reference, employee_id, current_attempt_number, status, assigned_reviewer_id,
        final_decision, final_remarks, reviewed_by, reviewed_at, tl_id, tl_name, created_at
      ) VALUES (
        'AV-2026-000003', '202140', 5, 'Pending BGV Review', ?,
        NULL, NULL, NULL, NULL, '202140', 'Surya', datetime('now', '-2 days')
      )
    `, [reviewerId]);

    // 8. Verification Progress for 202140
    await run(`
      INSERT INTO verification_progress (
        employee_id, attempt_number, current_step, details_confirmed, address_confirmed,
        address_is_same, submitted_address, residence_type, staying_since_month, staying_since_year,
        location_captured, latitude, longitude, gps_accuracy, distance_from_hr_meters, distance_category,
        selfie_captured, selfie_path, selfie_latitude, selfie_longitude, selfie_accuracy, selfie_captured_at,
        house_photo_captured, house_photo_path, house_photo_latitude, house_photo_longitude, house_photo_accuracy, house_photo_captured_at,
        street_photo_captured, street_photo_path, street_photo_latitude, street_photo_longitude, street_photo_accuracy, street_photo_captured_at,
        landmark_photo_captured, landmark_photo_path, landmark_photo_latitude, landmark_photo_longitude, landmark_photo_accuracy, landmark_photo_captured_at,
        door_photo_captured, door_photo_path, door_photo_latitude, door_photo_longitude, door_photo_accuracy, door_photo_captured_at,
        address_proof_uploaded, document_type, document_path, document_original_name,
        declaration_accepted, declaration_timestamp, last_saved_at
      ) VALUES (
        '202140', 5, 10, 1, 1,
        1, 'No 12, Gandhi Street, T Nagar, Chennai - 600017', 'Own House', 'January', '2020',
        1, 13.078997, 80.199004, 10.0, 15.0, 'Very Close',
        1, 'uploads/selfie_202140_1790151736256_8812.jpg', 13.078997, 80.199004, 10.0, '2026-09-23 08:00:00',
        1, 'uploads/house_202140_1790151673730_221522.jpg', 13.079000, 80.199016, 10.0, '2026-09-23 08:01:00',
        1, 'uploads/street_202140_1790151665397_21707.jpg', 13.079020, 80.199030, 10.0, '2026-09-23 08:02:00',
        1, 'uploads/landmark_202140_1790151653458_129718.jpg', 13.079050, 80.199060, 10.0, '2026-09-23 08:03:00',
        1, 'uploads/door_202140_1790151719597_471153.jpg', 13.079002, 80.199010, 10.0, '2026-09-23 08:04:00',
        1, 'Aadhaar Card', 'uploads/Aadhaar_Card_Front-1789137700441-744290144.pdf', 'Aadhaar_Card.pdf',
        1, '2026-09-23 08:05:00', datetime('now')
      )
    `);

    // 9. Verification Evidence for 202140 (All 6 photos/proofs)
    await run(`
      INSERT INTO verification_evidence (
        case_id, attempt_number, employee_id, evidence_type, file_path,
        latitude, longitude, gps_accuracy, captured_at, validation_status, tl_id, tl_name
      ) VALUES
        (NULL, 5, '202140', 'landmark_photo', 'uploads/landmark_202140_1790151653458_129718.jpg', 13.079050, 80.199060, 10.0, '2026-09-23 08:03:00', 'PASSED', '202140', 'Surya'),
        (NULL, 5, '202140', 'street_photo', 'uploads/street_202140_1790151665397_21707.jpg', 13.079020, 80.199030, 10.0, '2026-09-23 08:02:00', 'PASSED', '202140', 'Surya'),
        (NULL, 5, '202140', 'house_photo', 'uploads/house_202140_1790151673730_221522.jpg', 13.079000, 80.199016, 10.0, '2026-09-23 08:01:00', 'PASSED', '202140', 'Surya'),
        (NULL, 5, '202140', 'door_photo', 'uploads/door_202140_1790151719597_471153.jpg', 13.079002, 80.199010, 10.0, '2026-09-23 08:04:00', 'PASSED', '202140', 'Surya'),
        (NULL, 5, '202140', 'selfie', 'uploads/selfie_202140_1790151736256_8812.jpg', 13.078997, 80.199004, 10.0, '2026-09-23 08:00:00', 'PASSED', '202140', 'Surya'),
        (NULL, 5, '202140', 'address_proof', 'uploads/Aadhaar_Card_Front-1789137700441-744290144.pdf', NULL, NULL, NULL, '2026-09-23 08:05:00', 'PASSED', '202140', 'Surya')
    `);

    // 10. Bangalore Branch & Locations for branchLocationHierarchy.test.js
    await run(`
      INSERT OR IGNORE INTO branches (branch_code, branch_name, city, state, is_active)
      VALUES ('BGL', 'BANGALORE', 'Bangalore', 'Karnataka', 1)
    `);
    const blrBranch = await get("SELECT id FROM branches WHERE branch_code = 'BGL' OR branch_name = 'BANGALORE'");
    if (blrBranch) {
      await run(`
        INSERT OR IGNORE INTO locations (location_name, city, state, branch_id, is_active)
        VALUES 
          ('Electronic City', 'Bangalore', 'Karnataka', ?, 1),
          ('Bangalore Central', 'Bangalore', 'Karnataka', ?, 1)
      `, [blrBranch.id, blrBranch.id]);
    }
  } finally {
    await new Promise((resolve) => db.close(resolve));
  }
}

async function main() {
  console.log('================================================================');
  console.log(' STARTING ISOLATED TEST HARNESS (GSD PHASE 1 - PLAN 1.1)        ');
  console.log(` Isolated Port:          ${TEST_PORT}`);
  console.log(` Unique Test DB:         ${tempDbPath}`);
  console.log(` Unique Test Downloads:  ${tempDownloadsDir}`);
  console.log(' Total Suites Scheduled: 23 test suites in 3 deterministic tiers');
  console.log('================================================================\n');

  let overallSuccess = true;
  let serverProcess = null;
  const teardownErrors = [];

  // Ensure isolated temporary downloads directory exists
  if (!fs.existsSync(tempDownloadsDir)) {
    fs.mkdirSync(tempDownloadsDir, { recursive: true });
  }

  const commonEnv = {
    ...process.env,
    PORT: String(TEST_PORT),
    TEST_PORT: String(TEST_PORT),
    TEST_DB_PATH: tempDbPath,
    TEST_DOWNLOADS_DIR: tempDownloadsDir,
  };

  try {
    // =============================================================
    // TIER 1: Pure Unit Tests (Independent of DB & Server)
    // =============================================================
    console.log('================================================================');
    console.log(' TIER 1: PURE UNIT TESTS (5 SUITES)');
    console.log(' (Executed independently without database or server)');
    console.log('================================================================');

    const tier1Suites = [
      { file: 'strictPhotoValidationRules.test.js', timeoutMs: 15000 },
      { file: 'googleGeocoding.test.js', timeoutMs: 15000 },
      { file: 'multiLanguageOcrAndMatchScoring.test.js', timeoutMs: 25000 },
      { file: 'geospatialAndTolerance.test.js', timeoutMs: 15000 },
      { file: 'mapTileAndAddressMatching.test.js', timeoutMs: 15000 }
    ];

    for (const suite of tier1Suites) {
      const suitePath = path.join(__dirname, suite.file);
      console.log(`\n[RUNNING TIER 1] ${suite.file} ...`);
      const run = runSubprocess(suitePath, commonEnv, { timeoutMs: suite.timeoutMs, captureOutput: false, name: suite.file });
      const result = await run.promise;

      suiteResults.push({
        name: suite.file,
        tier: 'Tier 1 (Unit)',
        success: result.success,
        code: result.code,
        durationMs: result.durationMs,
        error: result.success ? null : (result.stderr || result.stdout || `Exit code ${result.code}`)
      });

      if (!result.success) {
        console.error(`❌ Suite failed: ${suite.file}`);
        overallSuccess = false;
        return; // Fast fail before DB initialization
      }
      console.log(`✓ Suite passed: ${suite.file} (${result.durationMs}ms)`);
    }

    // =============================================================
    // INITIALIZE & SEED ISOLATED DATABASE + BASELINE FIXTURES
    // =============================================================
    console.log('\n================================================================');
    console.log(' INITIALIZING & SEEDING TEMPORARY DATABASE');
    console.log(` Target DB: ${tempDbPath}`);
    console.log('================================================================');

    const seedRun = runSubprocess(SEED_SCRIPT, commonEnv, { timeoutMs: 30000, captureOutput: true, name: 'DatabaseSeed' });
    const seedResult = await seedRun.promise;

    if (!seedResult.success) {
      throw new Error(`Isolated DB seeding failed:\n${seedResult.stderr || seedResult.stdout}`);
    }
    console.log('✓ Base schema & seed data initialized successfully.');

    console.log('Seeding Plan 1.1 baseline fixtures (Managers, Team Leaders, 202140, AV-2026-000003, Evidence)...');
    await seedPlan11Fixtures(tempDbPath);
    console.log('✓ Plan 1.1 fixtures seeded and database connection cleanly closed.');

    // =============================================================
    // TIER 2: Direct Database Tests (Run against seeded temporary DB)
    // =============================================================
    console.log('\n================================================================');
    console.log(' TIER 2: DIRECT DATABASE TESTS (5 SUITES)');
    console.log(' (Executed against seeded temporary DB before server spawn)');
    console.log('================================================================');

    const tier2Suites = [
      { file: 'photoEvidenceCoords.test.js', timeoutMs: 25000 },
      { file: 'reverificationAndStrictLifecycle.test.js', timeoutMs: 25000 },
      { file: 'imageValidationAnd5Photos.test.js', timeoutMs: 25000 },
      { file: 'doorPhotoCoordsReview.test.js', timeoutMs: 20000 },
      { file: 'generateMultiPageReport.test.js', timeoutMs: 30000 }
    ];

    for (const suite of tier2Suites) {
      const suitePath = path.join(__dirname, suite.file);
      console.log(`\n[RUNNING TIER 2] ${suite.file} ...`);
      const run = runSubprocess(suitePath, commonEnv, { timeoutMs: suite.timeoutMs, captureOutput: false, name: suite.file });
      const result = await run.promise;

      suiteResults.push({
        name: suite.file,
        tier: 'Tier 2 (Direct DB)',
        success: result.success,
        code: result.code,
        durationMs: result.durationMs,
        error: result.success ? null : (result.stderr || result.stdout || `Exit code ${result.code}`)
      });

      if (!result.success) {
        console.error(`❌ Suite failed: ${suite.file}`);
        overallSuccess = false;
        return; // Fast fail before server launch
      }
      console.log(`✓ Suite passed: ${suite.file} (${result.durationMs}ms)`);
    }

    // =============================================================
    // TIER 3: HTTP Server Integration Tests (Port 5099)
    // =============================================================
    console.log('\n================================================================');
    console.log(' TIER 3: HTTP SERVER INTEGRATION TESTS (14 SUITES)');
    console.log(` Validating Port ${TEST_PORT} Availability & Launching Isolated Server`);
    console.log('================================================================');

    await checkPortAvailable(TEST_PORT);
    console.log(`✓ Port ${TEST_PORT} is free and unassigned.`);

    serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
      env: commonEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    registerProcess(serverProcess, 'TestServer');

    console.log(`[HARNESS] Test server spawned (PID: ${serverProcess.pid}). Waiting for health check...`);
    await waitForServer(serverProcess, TEST_PORT, 15000);
    console.log(`[HARNESS] Test server online on port ${TEST_PORT} bound to isolated DB.\n`);

    const tier3Suites = [
      { file: 'api.test.js', timeoutMs: 30000 },
      { file: 'branchLocationHierarchy.test.js', timeoutMs: 25000 },
      { file: 'designationMaster.test.js', timeoutMs: 25000 },
      { file: 'mastersCrud.test.js', timeoutMs: 25000 },
      { file: 'managerTlDependency.test.js', timeoutMs: 25000 },
      { file: 'optionalEmailUser.test.js', timeoutMs: 25000 },
      { file: 'rolesAndPermissions.test.js', timeoutMs: 25000 },
      { file: 'test_permissions_verification.cjs', timeoutMs: 30000 },
      { file: 'test_perms.cjs', timeoutMs: 25000 },
      { file: 'zeroLocationBranch.test.js', timeoutMs: 25000 },
      { file: 'employeeCrud.test.js', timeoutMs: 25000 },
      { file: 'userEdit.test.js', timeoutMs: 25000 },
      { file: 'adminReviewAndReporting.test.js', timeoutMs: 35000 },
      { file: 'endToEndFlowRegression.test.js', timeoutMs: 35000 }
    ];

    for (const suite of tier3Suites) {
      const suitePath = path.join(__dirname, suite.file);
      console.log(`\n[RUNNING TIER 3] ${suite.file} ...`);
      const run = runSubprocess(suitePath, commonEnv, { timeoutMs: suite.timeoutMs, captureOutput: false, name: suite.file });
      const result = await run.promise;

      suiteResults.push({
        name: suite.file,
        tier: 'Tier 3 (HTTP)',
        success: result.success,
        code: result.code,
        durationMs: result.durationMs,
        error: result.success ? null : (result.stderr || result.stdout || `Exit code ${result.code}`)
      });

      if (!result.success) {
        console.error(`❌ Suite failed: ${suite.file}`);
        overallSuccess = false;
        // Continue or stop? In integration suites, we record the failure and continue to get full results unless server died
        if (serverProcess && (serverProcess.exitCode !== null || serverProcess.signalCode !== null)) {
          console.error('❌ Test server terminated prematurely. Aborting remaining Tier 3 suites.');
          break;
        }
      } else {
        console.log(`✓ Suite passed: ${suite.file} (${result.durationMs}ms)`);
      }
    }

  } catch (err) {
    overallSuccess = false;
    console.error(`\n[HARNESS ERROR] Execution failure:\n${err.message}\n`);
  } finally {
    // =============================================================
    // TEARDOWN PHASE: Terminate all processes & cleanup temporary DB
    // =============================================================
    console.log('\n================================================================');
    console.log(' TEARDOWN: TERMINATING SUBPROCESSES & CLEANING TEMPORARY ASSETS ');
    console.log('================================================================');

    try {
      // 1. Inspect every registered process and retry termination if not yet confirmed stopped
      for (const entry of trackedProcesses) {
        try {
          if (entry.started && !entry.confirmedStopped) {
            console.log(`[TEARDOWN] Inspecting unconfirmed started process: ${entry.name} (PID: ${entry.pid}). Retrying termination...`);
            await terminateProcess(entry, 8000);
            console.log(`[TEARDOWN] ${entry.name} (PID: ${entry.pid}) confirmed stopped.`);
          } else if (entry.started) {
            console.log(`[TEARDOWN] ${entry.name} (PID: ${entry.pid}) already confirmed stopped.`);
          } else {
            console.log(`[TEARDOWN] ${entry.name} never started (no PID assigned).`);
          }
        } catch (procErr) {
          teardownErrors.push(`Failed to confirm termination of ${entry.name} (PID: ${entry.pid}): ${procErr.message}`);
          console.error(`❌ [TEARDOWN ERROR] ${procErr.message}`);
        }
      }

      // 2. Evaluate if ANY started process remains unconfirmed
      const unstoppedProcesses = trackedProcesses.filter((e) => e.started && !e.confirmedStopped);

      if (unstoppedProcesses.length > 0) {
        // Cleanup blocked!
        for (const unstopped of unstoppedProcesses) {
          console.error(`❌ [CLEANUP BLOCKED] Started process still unconfirmed: ${unstopped.name} (PID: ${unstopped.pid})`);
          teardownErrors.push(`Process unconfirmed: ${unstopped.name} (PID: ${unstopped.pid})`);
        }
        teardownErrors.push(`Preserving temporary database [${tempDbPath}] to prevent unsafe deletion.`);

        console.warn(`\n⚠️  [TEARDOWN WARNING] TEMPORARY DATABASE PRESERVED:`);
        console.warn(`   Database Path: ${tempDbPath}`);
        console.warn(`   Reason: The following started child process(es) could not be confirmed stopped:`);
        unstoppedProcesses.forEach((p) => {
          console.warn(`     - Process Name: ${p.name}, PID: ${p.pid}, Error: ${p.terminationError || 'Unconfirmed'}`);
        });
        console.warn(`   Please inspect and clean up manually if the process has hung.\n`);
      } else {
        // 3. Delete temporary database files ONLY when every started process is confirmed stopped
        console.log(`[TEARDOWN] All started child process(es) confirmed stopped. Proceeding with file cleanup.`);
        let deletionFailed = false;

        // Clean temporary database auxiliary files
        for (const file of targetAuxiliaryFiles) {
          try {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
              console.log(`[TEARDOWN] Deleted temporary file: ${path.basename(file)}`);
            }
          } catch (unlinkErr) {
            deletionFailed = true;
            teardownErrors.push(`Failed to delete temporary file [${file}]: ${unlinkErr.message}`);
            console.error(`❌ [TEARDOWN ERROR] Failed to delete ${file}: ${unlinkErr.message}`);
          }
        }

        // Clean temporary downloads directory
        try {
          if (fs.existsSync(tempDownloadsDir)) {
            fs.rmSync(tempDownloadsDir, { recursive: true, force: true });
            console.log(`[TEARDOWN] Deleted temporary downloads directory: ${path.basename(tempDownloadsDir)}`);
          }
        } catch (rmDirErr) {
          deletionFailed = true;
          teardownErrors.push(`Failed to delete temporary downloads dir [${tempDownloadsDir}]: ${rmDirErr.message}`);
          console.error(`❌ [TEARDOWN ERROR] Failed to delete downloads directory: ${rmDirErr.message}`);
        }

        if (deletionFailed) {
          console.error(`❌ [TEARDOWN ERROR] One or more temporary files could not be deleted.`);
        }
      }
    } catch (unexpectedTeardownErr) {
      console.error(`❌ [CRITICAL TEARDOWN EXCEPTION] Unexpected failure during teardown:`, unexpectedTeardownErr);
      teardownErrors.push(`Unexpected teardown exception: ${unexpectedTeardownErr.message}`);
    } finally {
      // 4. Execution Summary (Guaranteed to execute regardless of unexpected errors)
      const finalUnconfirmedStarted = trackedProcesses.filter((e) => e.started && !e.confirmedStopped);
      const hasTeardownErrors = teardownErrors.length > 0;
      const allProcessesConfirmed = finalUnconfirmedStarted.length === 0;
      const allSuitesRan = suiteResults.length === 24;
      const allSuitesPassed = allSuitesRan && suiteResults.every((s) => s.success);
      const isSuccess = overallSuccess && allSuitesPassed && allProcessesConfirmed && !hasTeardownErrors;

      console.log('\n================================================================');
      console.log(' COMPLETE ALL-SUITE EXECUTION SUMMARY (24 SUITES)               ');
      console.log('================================================================');
      console.log(' #  | Suite Name                                | Tier          | Status  | Time (ms)');
      console.log('----------------------------------------------------------------');

      suiteResults.forEach((s, idx) => {
        const num = String(idx + 1).padStart(2, ' ');
        const name = s.name.padEnd(41, ' ');
        const tier = s.tier.padEnd(13, ' ');
        const status = s.success ? 'PASSED ✓' : 'FAILED ❌';
        const time = String(s.durationMs || 0).padStart(6, ' ');
        console.log(` ${num} | ${name} | ${tier} | ${status} | ${time}`);
      });

      if (suiteResults.length < 24) {
        console.log(`\n⚠️  Only ${suiteResults.length} of 24 test suites executed due to early termination.`);
      }

      console.log('----------------------------------------------------------------');
      console.log(`Total Suites Ran:      ${suiteResults.length} / 24`);
      console.log(`Suites Passed:         ${suiteResults.filter((s) => s.success).length}`);
      console.log(`Suites Failed:         ${suiteResults.filter((s) => !s.success).length}`);
      console.log(`Subprocesses Stopped:  ${allProcessesConfirmed ? 'ALL CONFIRMED ✓' : 'UNCONFIRMED / FAILED ❌'}`);
      console.log(`Cleanup Status:        ${hasTeardownErrors ? `${teardownErrors.length} ERROR(S) ❌` : 'CLEAN ✓'}`);
      console.log(`Overall Result:        ${isSuccess ? 'SUCCESS (Exit Code 0) ✓' : 'FAILURE (Exit Code 1) ❌'}`);

      if (finalUnconfirmedStarted.length > 0) {
        console.log('\nUnconfirmed Started Processes:');
        finalUnconfirmedStarted.forEach((p) => {
          console.log(` - ${p.name} (PID: ${p.pid}), Error: ${p.terminationError || p.spawnError || 'Awaiting exit'}`);
        });
      }

      if (teardownErrors.length > 0) {
        console.log('\nTeardown Error Details:');
        teardownErrors.forEach((e) => console.log(` - ${e}`));
      }
      console.log('================================================================\n');

      // Explicitly bind exit code to the computed isSuccess result
      process.exitCode = isSuccess ? 0 : 1;
    }
  }
}

main();
