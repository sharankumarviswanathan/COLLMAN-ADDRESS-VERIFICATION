/**
 * Isolated Test Runner for Phase D
 * - Runs pure unit tests (strictPhotoValidationRules) independently before server startup
 * - Initializes and seeds unique temporary SQLite DB via isolated seed subprocess
 * - Uses process.execPath for all child process invocations
 * - Validates port 5099 availability before server startup
 * - Spawns test server on isolated port 5099 inheriting TEST_DB_PATH
 * - Polls /api/health with stdout/stderr error capture and unconditional timer cleanup
 * - Runs integration tests (zeroLocationBranch) against isolated server and port
 * - Immediate registration of all child processes into a single trackedProcesses registry
 * - Permanent error and exit listeners prevent unhandled EventEmitter errors post-timeout
 * - Decouples spawn/runtime errors from termination: only 'exit'/'close' confirms termination
 * - Unstarted processes (no PID) tracked separately from started processes
 * - Exception-safe teardown: unexpected errors caught, logged, and set non-zero exit code
 * - Preserves temporary DB and auxiliary files if any started process remains unconfirmed
 * - Deletes temporary DB only if every started process is confirmed stopped
 * - Inner finally block recalculates unconfirmed started processes directly from registry
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

// Unique temporary database filename for this specific test run
const uniqueId = `isolated_test_${Date.now()}_${process.pid}_${Math.random().toString(36).substring(2, 8)}`;
const tempDbPath = path.join(__dirname, '..', 'db', `${uniqueId}.db`);

// Auxiliary files specifically bound to this unique database
const targetAuxiliaryFiles = [
  tempDbPath,
  `${tempDbPath}-wal`,
  `${tempDbPath}-shm`,
  `${tempDbPath}-journal`,
];

// Single shared registry for every child process spawned in this test run
const trackedProcesses = [];

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

async function main() {
  console.log('================================================================');
  console.log(' STARTING ISOLATED TEST HARNESS (PHASE D)                       ');
  console.log(` Isolated Port:        ${TEST_PORT}`);
  console.log(` Unique Test DB:       ${tempDbPath}`);
  console.log('================================================================\n');

  let overallSuccess = true;
  let serverProcess = null;
  const teardownErrors = [];

  const commonEnv = {
    ...process.env,
    PORT: String(TEST_PORT),
    TEST_PORT: String(TEST_PORT),
    TEST_DB_PATH: tempDbPath,
  };

  try {
    // -------------------------------------------------------------
    // STEP 1: Run pure unit test independently (no server needed)
    // -------------------------------------------------------------
    const unitSuitePath = path.join(__dirname, 'strictPhotoValidationRules.test.js');
    console.log('----------------------------------------------------------------');
    console.log(` Running Unit Test Suite: ${path.basename(unitSuitePath)}`);
    console.log(' (Executed independently with bounded 15s timeout, no server needed)');
    console.log('----------------------------------------------------------------');

    const unitRun = runSubprocess(unitSuitePath, commonEnv, { timeoutMs: 15000, captureOutput: false, name: 'UnitTests' });
    const unitResult = await unitRun.promise;

    if (!unitResult.success) {
      console.error(`❌ Unit test suite failed: ${path.basename(unitSuitePath)}`);
      overallSuccess = false;
      return; // Skip server startup on unit test failure
    }
    console.log(`✓ Unit test suite passed: ${path.basename(unitSuitePath)}\n`);

    // -------------------------------------------------------------
    // STEP 2: Initialize & Seed isolated temporary database
    // -------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log(' Initializing & Seeding Isolated Temporary Database');
    console.log(` Target Database: ${tempDbPath}`);
    console.log('----------------------------------------------------------------');
    const seedRun = runSubprocess(SEED_SCRIPT, commonEnv, { timeoutMs: 30000, captureOutput: true, name: 'DatabaseSeed' });
    const seedResult = await seedRun.promise;

    if (!seedResult.success) {
      throw new Error(`Isolated DB seeding failed:\n${seedResult.stderr || seedResult.stdout}`);
    }
    console.log('✓ Isolated database seeded successfully (admin user and initial records created).\n');

    // -------------------------------------------------------------
    // STEP 3: Validate port availability & spawn isolated test server
    // -------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log(` Validating Port ${TEST_PORT} Availability & Spawning Server`);
    console.log('----------------------------------------------------------------');
    await checkPortAvailable(TEST_PORT);
    console.log(`✓ Confirmed port ${TEST_PORT} is free and unassigned.`);

    serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
      env: commonEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    registerProcess(serverProcess, 'TestServer');

    console.log(`[HARNESS] Server process spawned (PID: ${serverProcess.pid}). Waiting for health check...`);
    await waitForServer(serverProcess, TEST_PORT, 15000);
    console.log(`[HARNESS] Test server online on port ${TEST_PORT} using isolated DB.\n`);

    // -------------------------------------------------------------
    // STEP 4: Run integration test suite
    // -------------------------------------------------------------
    const integrationSuitePath = path.join(__dirname, 'zeroLocationBranch.test.js');
    console.log('----------------------------------------------------------------');
    console.log(` Running Integration Test Suite: ${path.basename(integrationSuitePath)}`);
    console.log(' (Executed with bounded 30s timeout against isolated server)');
    console.log('----------------------------------------------------------------');

    const intRun = runSubprocess(integrationSuitePath, commonEnv, { timeoutMs: 30000, captureOutput: false, name: 'IntegrationTests' });
    const intResult = await intRun.promise;

    if (!intResult.success) {
      console.error(`❌ Integration test suite failed: ${path.basename(integrationSuitePath)}`);
      overallSuccess = false;
    } else {
      console.log(`✓ Integration test suite passed: ${path.basename(integrationSuitePath)}\n`);
    }

  } catch (err) {
    overallSuccess = false;
    console.error(`\n[HARNESS ERROR] Execution failure:\n${err.message}\n`);
  } finally {
    // -------------------------------------------------------------
    // TEARDOWN PHASE: Terminate all processes & cleanup database
    // -------------------------------------------------------------
    console.log('================================================================');
    console.log(' TEARDOWN: TERMINATING SUBPROCESSES & CLEANING TEMPORARY DB     ');
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

        if (deletionFailed) {
          console.error(`❌ [TEARDOWN ERROR] One or more temporary database files could not be deleted.`);
        }
      }
    } catch (unexpectedTeardownErr) {
      console.error(`❌ [CRITICAL TEARDOWN EXCEPTION] Unexpected failure during teardown:`, unexpectedTeardownErr);
      teardownErrors.push(`Unexpected teardown exception: ${unexpectedTeardownErr.message}`);
    } finally {
      // 4. Execution Summary (Guaranteed to execute regardless of unexpected errors)
      // Recalculate directly from trackedProcesses to guarantee fresh ground truth
      const finalUnconfirmedStarted = trackedProcesses.filter((e) => e.started && !e.confirmedStopped);
      const hasTeardownErrors = teardownErrors.length > 0;
      const allProcessesConfirmed = finalUnconfirmedStarted.length === 0;
      const isSuccess = overallSuccess && allProcessesConfirmed && !hasTeardownErrors;

      console.log('\n================================================================');
      console.log(' EXECUTION SUMMARY                                              ');
      console.log('================================================================');
      console.log(`Test Suites Status:    ${overallSuccess ? 'ALL PASSED ✓' : 'FAILED ❌'}`);
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
