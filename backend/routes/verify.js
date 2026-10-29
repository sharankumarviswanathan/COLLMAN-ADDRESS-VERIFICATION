const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { query } = require('../db/database');
const { authenticateEmployeeSession, generateEmployeeSessionToken } = require('../middleware/auth');
const { employeeIdValidationLimiter } = require('../middleware/rateLimiter');
const { upload, uploadsDir } = require('../middleware/upload');
const { calculateDistanceMeters, classifyDistance } = require('../utils/geoUtils');
const { validateImage } = require('../utils/imageValidator');
const { validateAddressProofDocument } = require('../utils/addressProofValidator');

// Helper to sanitize base64 image strings and save to disk
function saveBase64Image(base64Data, prefix = 'img') {
  if (!base64Data || typeof base64Data !== 'string') {
    throw new Error('Invalid base64 image payload');
  }

  let base64String = base64Data.trim();

  // If already an existing uploaded file path or URL: e.g. /uploads/selfie_17510_...jpg
  if (base64String.includes('/uploads/') || base64String.startsWith('uploads/')) {
    const fileName = path.basename(base64String.split('?')[0]);
    const filePath = path.join(uploadsDir, fileName);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) {
      return {
        fileName,
        filePath,
        mimeType: 'image/jpeg',
        fileSize: fs.statSync(filePath).size
      };
    }
  }

  // If already a full local disk path
  if (fs.existsSync(base64String) && fs.statSync(base64String).size > 100) {
    return {
      fileName: path.basename(base64String),
      filePath: base64String,
      mimeType: 'image/jpeg',
      fileSize: fs.statSync(base64String).size
    };
  }

  let mimeType = 'image/jpeg';

  // If it has data URL prefix: data:image/png;base64,...
  if (base64String.startsWith('data:')) {
    const commaIndex = base64String.indexOf(',');
    if (commaIndex !== -1) {
      const header = base64String.substring(0, commaIndex);
      const mimeMatch = header.match(/data:([^;]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
      base64String = base64String.substring(commaIndex + 1);
    }
  }

  // Remove any remaining whitespace or newlines
  base64String = base64String.replace(/\s/g, '');

  const buffer = Buffer.from(base64String, 'base64');
  if (buffer.length < 100) {
    throw new Error('Invalid image payload: payload is too small or invalid.');
  }

  let ext = '.jpg';
  if (mimeType.includes('png')) ext = '.png';
  else if (mimeType.includes('webp')) ext = '.webp';

  const fileName = `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    filePath,
    mimeType,
    fileSize: buffer.length
  };
}

// Helper to immediately record each photo's GPS coordinates and timestamp separately in verification_evidence
async function recordPhotoEvidence({
  employeeId,
  evidenceType,
  filePath,
  mimeType,
  fileSize,
  latitude,
  longitude,
  accuracy,
  capturedAt,
  validationStatus = 'PASSED',
  validationReport = null,
  tlId = null,
  tlName = null
}) {
  try {
    const caseRec = await query.get(
      'SELECT id, current_attempt_number FROM verification_cases WHERE employee_id = ?',
      [employeeId]
    );
    const progRec = await query.get(
      'SELECT attempt_number FROM verification_progress WHERE employee_id = ?',
      [employeeId]
    );
    const caseId = caseRec?.id || null;
    const attemptNo = progRec?.attempt_number || caseRec?.current_attempt_number || 1;

    // Delete any previous record for this attempt & evidence type so retakes cleanly replace
    await query.run(
      'DELETE FROM verification_evidence WHERE employee_id = ? AND attempt_number = ? AND evidence_type = ?',
      [employeeId, attemptNo, evidenceType]
    );

    await query.run(
      `INSERT INTO verification_evidence (
        case_id, attempt_number, employee_id, evidence_type, file_path,
        mime_type, file_size, latitude, longitude, gps_accuracy, captured_at,
        validation_status, validation_report, validated_at, tl_id, tl_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      [
        caseId,
        attemptNo,
        employeeId,
        evidenceType,
        filePath,
        mimeType || 'image/jpeg',
        fileSize || 0,
        latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null,
        longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null,
        accuracy !== undefined && accuracy !== null && accuracy !== '' ? Number(accuracy) : null,
        capturedAt || new Date().toISOString(),
        validationStatus,
        typeof validationReport === 'object' ? JSON.stringify(validationReport) : validationReport,
        tlId || null,
        tlName || null
      ]
    );
  } catch (evErr) {
    console.warn(`Failed to insert into verification_evidence for ${evidenceType}:`, evErr.message);
  }
}

function getBufferFromBase64(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') return null;
  try {
    // If it points to an existing uploads file or disk path
    if (base64Str.includes('/uploads/') || base64Str.startsWith('uploads/')) {
      const fileName = path.basename(base64Str.split('?')[0]);
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath);
      }
    }
    if (fs.existsSync(base64Str)) {
      return fs.readFileSync(base64Str);
    }
    let clean = base64Str;
    if (clean.includes(',')) clean = clean.split(',')[1];
    clean = clean.replace(/\s/g, '');
    const buf = Buffer.from(clean, 'base64');
    if (buf.length < 50) return null;
    return buf;
  } catch (e) {
    return null;
  }
}

// Helper to audit log verification activities with TL ID and Agent ID
async function recordVerificationAuditLog(req, action, details) {
  try {
    const empId = req.employee?.employee_id || req.agentId || null;
    const actorName = req.employee?.employee_name || 'Employee';
    const tlId = req.tlId || null;
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_name, action, employee_id, agent_id, tl_id, ip_address, details)
       VALUES ('Employee', ?, ?, ?, ?, ?, ?, ?)`,
      [actorName, action, empId, empId, tlId, req.ip, details]
    );
  } catch (err) {
    console.warn(`Failed to write audit log for ${action}:`, err.message);
  }
}

// Helper to look up and authorize a Team Leader from users or employees table
async function findAuthorizedTeamLeader(tlId) {
  if (!tlId || typeof tlId !== 'string') return null;
  const cleanTlId = tlId.trim();

  // 1. Look up in users table by username, full_name, or user ID for active Team Leader (or Admin roles)
  const tlUser = await query.get(
    `SELECT id, username, full_name, email, role, branch, department
     FROM users
     WHERE (UPPER(username) = UPPER(?) OR UPPER(id) = UPPER(?) OR UPPER(full_name) = UPPER(?))
       AND (role = 'Team Leader' OR role = 'Super Admin' OR role = 'HR/Admin')
       AND is_active = 1`,
    [cleanTlId, cleanTlId, cleanTlId]
  );
  if (tlUser) {
    return {
      id: tlUser.id,
      tlId: tlUser.username || String(tlUser.id),
      tlName: tlUser.full_name,
      role: tlUser.role,
      branch: tlUser.branch || '',
      department: tlUser.department || ''
    };
  }

  // 2. Look up in employees table where designation contains Team Leader or TL
  const tlEmp = await query.get(
    `SELECT id, employee_id, employee_name, designation, department, branch, verification_status
     FROM employees
     WHERE (UPPER(employee_id) = UPPER(?) OR UPPER(employee_name) = UPPER(?))
       AND (LOWER(designation) LIKE '%team leader%' OR LOWER(designation) LIKE '%tl%' OR LOWER(designation) LIKE '%lead%')`,
    [cleanTlId, cleanTlId]
  );
  if (tlEmp) {
    return {
      id: tlEmp.id,
      tlId: tlEmp.employee_id,
      tlName: tlEmp.employee_name,
      role: 'Team Leader',
      branch: tlEmp.branch || '',
      department: tlEmp.department || ''
    };
  }

  return null;
}

// 0. POST /api/verify/validate-tl (Mandatory Step 1 Phase A - TL Identification & Validation)
router.post('/validate-tl', employeeIdValidationLimiter, async (req, res) => {
  try {
    const { tlId } = req.body;
    if (!tlId || typeof tlId !== 'string' || !tlId.trim()) {
      return res.status(400).json({ error: 'Please enter the Team Leader Employee ID.' });
    }

    const cleanTlId = tlId.trim();
    const tl = await findAuthorizedTeamLeader(cleanTlId);

    if (!tl) {
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_name, action, ip_address, details, tl_id)
         VALUES ('Employee', 'Unauthenticated', 'TL ID Validation Failed', ?, ?, ?)`,
        [req.ip, `Entered unverified TL ID: ${cleanTlId}`, cleanTlId]
      );
      return res.status(404).json({
        error: 'Team Leader Employee ID not found or unauthorized. Please verify the TL ID with your supervisor.'
      });
    }

    // Audit log successful TL validation
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_name, action, ip_address, details, tl_id)
       VALUES ('Employee', ?, 'TL ID Validated', ?, ?, ?)`,
      [tl.tlName, req.ip, `Team Leader ${tl.tlName} (${tl.tlId}) validated`, tl.tlId]
    );

    const tlObj = {
      tlId: tl.tlId,
      tlName: tl.tlName,
      role: tl.role,
      branch: tl.branch,
      department: tl.department
    };

    res.json({
      success: true,
      valid: true,
      tl: tlObj,
      teamLeader: tlObj
    });
  } catch (err) {
    console.error('Validate TL error:', err);
    res.status(500).json({ error: 'Failed to validate Team Leader ID.' });
  }
});

// 1. POST /api/verify/validate-id (Mandatory Step 1 Phase B - Agent ID & TL Assignment Validation)
router.post('/validate-id', employeeIdValidationLimiter, async (req, res) => {
  try {
    const { tlId, agentId, employeeId } = req.body;
    const rawAgentId = agentId || employeeId;

    // Backend enforcement: TL ID is mandatory
    if (!tlId || typeof tlId !== 'string' || !tlId.trim()) {
      return res.status(400).json({ error: 'Team Leader Employee ID is required to validate the agent.' });
    }

    // Backend enforcement: Agent ID is mandatory
    if (!rawAgentId || typeof rawAgentId !== 'string' || !rawAgentId.trim()) {
      return res.status(400).json({ error: 'Please enter the Agent Employee ID.' });
    }

    const cleanTlId = tlId.trim();
    const cleanAgentId = rawAgentId.trim().toUpperCase();

    // 1. Validate TL against authorized records
    const tl = await findAuthorizedTeamLeader(cleanTlId);
    if (!tl) {
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_name, action, agent_id, tl_id, ip_address, details)
         VALUES ('Employee', 'Unauthenticated', 'Validation Blocked (Invalid TL)', ?, ?, ?, ?)`,
        [cleanAgentId, cleanTlId, req.ip, `Attempted validation with invalid/unauthorized TL ID: ${cleanTlId}`]
      );
      return res.status(404).json({
        error: 'Team Leader Employee ID not found or unauthorized.'
      });
    }

    // 2. Exact match against HR Employee Master for the Agent
    const employee = await query.get(
      `SELECT employee_id, employee_name, mobile_number, email_id, date_of_joining,
              department, designation, branch, location, reporting_manager, team_leader, assigned_reviewer_id,
              hr_current_address, hr_latitude, hr_longitude,
              verification_required, verification_status
       FROM employees WHERE UPPER(employee_id) = ?`,
      [cleanAgentId]
    );

    if (!employee) {
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_name, action, agent_id, tl_id, ip_address, details)
         VALUES ('Employee', ?, 'Agent ID Validation Failed', ?, ?, ?, ?)`,
        [tl.tlName, cleanAgentId, tl.tlId, req.ip, `Entered unverified Agent ID: ${cleanAgentId} under TL: ${tl.tlId}`]
      );

      return res.status(404).json({
        code: 'AGENT_NOT_FOUND',
        error: `Agent Employee ID "${cleanAgentId}" not found. Please check your Agent ID and try again.`
      });
    }

    // 3. Verify Agent is assigned to the entered TL
    const assignedTl = (employee.team_leader || '').trim();
    if (!assignedTl) {
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_name, action, employee_id, agent_id, tl_id, ip_address, details)
         VALUES ('Employee', ?, 'Agent Validation Blocked (Unassigned)', ?, ?, ?, ?, ?)`,
        [employee.employee_name, cleanAgentId, cleanAgentId, tl.tlId, req.ip, `Agent ${cleanAgentId} (${employee.employee_name}) is unassigned to any Team Leader`]
      );
      return res.status(403).json({
        error: `Agent ${cleanAgentId} (${employee.employee_name}) is currently not assigned to any Team Leader. Please contact Collman HR to assign a Team Leader before proceeding with verification.`,
        code: 'AGENT_UNASSIGNED'
      });
    }

    // Check if assigned TL matches entered TL (by TL ID, TL Name, or user ID)
    const matchesTlId = assignedTl.toUpperCase() === tl.tlId.toUpperCase();
    const matchesTlName = assignedTl.toUpperCase() === tl.tlName.toUpperCase();
    const matchesUserId = tl.id && (assignedTl === String(tl.id) || employee.assigned_reviewer_id === tl.id);

    if (!matchesTlId && !matchesTlName && !matchesUserId) {
      await query.run(
        `INSERT INTO audit_logs (actor_type, actor_name, action, employee_id, agent_id, tl_id, ip_address, details)
         VALUES ('Employee', ?, 'Agent Validation Blocked (Assigned to Other TL)', ?, ?, ?, ?, ?)`,
        [employee.employee_name, cleanAgentId, cleanAgentId, tl.tlId, req.ip, `Agent ${cleanAgentId} (${employee.employee_name}) is assigned to "${assignedTl}", not TL "${tl.tlName} (${tl.tlId})"`]
      );
      return res.status(403).json({
        error: `Agent ${cleanAgentId} (${employee.employee_name}) is assigned to Team Leader "${assignedTl}", not "${tl.tlName} (${tl.tlId})". Verification access is restricted to the assigned Team Leader.`,
        code: 'AGENT_ASSIGNED_TO_OTHER_TL',
        assignedTl,
        enteredTl: `${tl.tlName} (${tl.tlId})`
      });
    }

    // Check verification status
    const status = employee.verification_status;

    if (status === 'Inactive') {
      return res.status(403).json({
        error: 'Your verification is currently inactive. Please contact Collman HR.'
      });
    }

    if (status === 'Verified') {
      return res.json({
        alreadyVerified: true,
        status: 'Verified',
        employeeId: employee.employee_id,
        employeeName: employee.employee_name,
        tlName: tl.tlName,
        tlId: tl.tlId,
        message: 'Your address verification has already been completed.'
      });
    }

    if (status === 'Submitted' || status === 'Pending BGV Review') {
      return res.json({
        alreadySubmitted: true,
        status: status,
        employeeId: employee.employee_id,
        employeeName: employee.employee_name,
        tlName: tl.tlName,
        tlId: tl.tlId,
        message: 'Your address verification has already been submitted and is under review.'
      });
    }

    // Determine current attempt number
    let attemptNumber = 1;
    const existingCase = await query.get(
      'SELECT id, current_attempt_number, status, case_reference FROM verification_cases WHERE employee_id = ?',
      [cleanAgentId]
    );
    if (existingCase) {
      attemptNumber = existingCase.current_attempt_number || 1;
      if (status === 'Reverification Required') {
        attemptNumber = (existingCase.current_attempt_number || 1) + 1;
      }
    }

    // Retrieve or initialize progress and update TL
    let progress = await query.get(
      'SELECT * FROM verification_progress WHERE employee_id = ?',
      [cleanAgentId]
    );

    if (!progress) {
      await query.run(
        `INSERT INTO verification_progress (
          employee_id, attempt_number, current_step, submitted_address,
          tl_id, tl_name, joint_selfie_tl_id, joint_selfie_tl_name
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
        [cleanAgentId, attemptNumber, employee.hr_current_address, tl.tlId, tl.tlName, tl.tlId, tl.tlName]
      );
      progress = await query.get('SELECT * FROM verification_progress WHERE employee_id = ?', [cleanAgentId]);
    } else {
      await query.run(
        `UPDATE verification_progress SET
           tl_id = ?, tl_name = ?,
           joint_selfie_tl_id = COALESCE(joint_selfie_tl_id, ?),
           joint_selfie_tl_name = COALESCE(joint_selfie_tl_name, ?)
         WHERE employee_id = ?`,
        [tl.tlId, tl.tlName, tl.tlId, tl.tlName, cleanAgentId]
      );
    }

    // Issue secure temporary session token with TL ID and Agent ID
    const sessionToken = generateEmployeeSessionToken(employee.employee_id, attemptNumber, tl.tlId, tl.tlName);

    // Audit log successful validation
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_name, action, employee_id, agent_id, tl_id, ip_address, details)
       VALUES ('Employee', ?, 'Agent & TL Validated', ?, ?, ?, ?, ?)`,
      [
        employee.employee_name,
        cleanAgentId,
        cleanAgentId,
        tl.tlId,
        req.ip,
        `Agent ${cleanAgentId} (${employee.employee_name}) validated under Team Leader ${tl.tlName} (${tl.tlId})`
      ]
    );

    // Return matching employee and TL data
    res.json({
      success: true,
      token: sessionToken,
      tl: {
        tlId: tl.tlId,
        tlName: tl.tlName,
        role: tl.role,
        branch: tl.branch || '',
        department: tl.department || ''
      },
      employee: {
        employeeId: employee.employee_id,
        employeeName: employee.employee_name,
        branch: employee.branch,
        department: employee.department,
        designation: employee.designation,
        dateOfJoining: employee.date_of_joining,
        hrAddress: employee.hr_current_address,
        hrLatitude: employee.hr_latitude,
        hrLongitude: employee.hr_longitude,
        status: employee.verification_status,
        teamLeader: employee.team_leader,
        tlId: tl.tlId,
        tlName: tl.tlName,
        caseReference: existingCase?.case_reference || `AV-${employee.employee_id}`
      },
      progress: {
        currentStep: progress.current_step || 1,
        detailsConfirmed: !!progress.details_confirmed,
        detailsCorrectionRemark: progress.details_correction_remark || '',
        addressConfirmed: !!progress.address_confirmed,
        addressIsSame: progress.address_is_same !== 0,
        addressDifferenceReason: progress.address_difference_reason || '',
        submittedAddress: progress.submitted_address || employee.hr_current_address,
        residenceType: progress.residence_type || '',
        stayingSinceMonth: progress.staying_since_month || '',
        stayingSinceYear: progress.staying_since_year || '',
        locationCaptured: !!progress.location_captured,
        latitude: progress.latitude,
        longitude: progress.longitude,
        gpsAccuracy: progress.gps_accuracy,
        distanceFromHrMeters: progress.distance_from_hr_meters,
        distanceCategory: progress.distance_category,
        selfieCaptured: !!progress.selfie_captured,
        selfiePath: progress.selfie_path ? `/uploads/${path.basename(progress.selfie_path)}` : null,
        selfieLatitude: progress.selfie_latitude,
        selfieLongitude: progress.selfie_longitude,
        selfieAccuracy: progress.selfie_accuracy,
        selfieCapturedAt: progress.selfie_captured_at,
        housePhotoCaptured: !!progress.house_photo_captured,
        housePhotoPath: progress.house_photo_path ? `/uploads/${path.basename(progress.house_photo_path)}` : null,
        housePhotoLatitude: progress.house_photo_latitude,
        housePhotoLongitude: progress.house_photo_longitude,
        housePhotoAccuracy: progress.house_photo_accuracy,
        housePhotoCapturedAt: progress.house_photo_captured_at,
        streetPhotoCaptured: !!progress.street_photo_captured,
        streetPhotoPath: progress.street_photo_path ? `/uploads/${path.basename(progress.street_photo_path)}` : null,
        streetPhotoLatitude: progress.street_photo_latitude,
        streetPhotoLongitude: progress.street_photo_longitude,
        streetPhotoAccuracy: progress.street_photo_accuracy,
        streetPhotoCapturedAt: progress.street_photo_captured_at,
        landmarkPhotoCaptured: !!progress.landmark_photo_captured,
        landmarkPhotoPath: progress.landmark_photo_path ? `/uploads/${path.basename(progress.landmark_photo_path)}` : null,
        landmarkPhotoLatitude: progress.landmark_photo_latitude,
        landmarkPhotoLongitude: progress.landmark_photo_longitude,
        landmarkPhotoAccuracy: progress.landmark_photo_accuracy,
        landmarkPhotoCapturedAt: progress.landmark_photo_captured_at,
        doorPhotoCaptured: !!progress.door_photo_captured,
        doorPhotoPath: progress.door_photo_path ? `/uploads/${path.basename(progress.door_photo_path)}` : null,
        doorPhotoLatitude: progress.door_photo_latitude,
        doorPhotoLongitude: progress.door_photo_longitude,
        doorPhotoAccuracy: progress.door_photo_accuracy,
        doorPhotoCapturedAt: progress.door_photo_captured_at,
        jointSelfieCaptured: !!progress.joint_selfie_captured,
        jointSelfiePath: progress.joint_selfie_path ? `/uploads/${path.basename(progress.joint_selfie_path)}` : null,
        jointSelfieLatitude: progress.joint_selfie_latitude,
        jointSelfieLongitude: progress.joint_selfie_longitude,
        jointSelfieAccuracy: progress.joint_selfie_accuracy,
        jointSelfieCapturedAt: progress.joint_selfie_captured_at,
        jointSelfieTlId: progress.joint_selfie_tl_id || tl.tlId,
        jointSelfieTlName: progress.joint_selfie_tl_name || tl.tlName,
        tlId: progress.tl_id || tl.tlId,
        tlName: progress.tl_name || tl.tlName,
        addressProofUploaded: !!progress.address_proof_uploaded,
        documentType: progress.document_type || '',
        documentOriginalName: progress.document_original_name || '',
        documentUrl: progress.document_path ? `/uploads/${path.basename(progress.document_path)}` : null,
        documentBackOriginalName: progress.document_back_original_name || '',
        documentBackUrl: progress.document_back_path ? `/uploads/${path.basename(progress.document_back_path)}` : null,
        declarationAccepted: !!progress.declaration_accepted
      }
    });
  } catch (err) {
    console.error('Validation error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// 2. GET /api/verify/progress - Resume progress
router.get('/progress', authenticateEmployeeSession, async (req, res) => {
  try {
    const progress = await query.get(
      'SELECT * FROM verification_progress WHERE employee_id = ?',
      [req.employee.employee_id]
    );

    const caseRec = await query.get(
      'SELECT id, case_reference FROM verification_cases WHERE employee_id = ?',
      [req.employee.employee_id]
    );

    let formattedProgress = progress || {};
    if (progress) {
      formattedProgress = {
        ...progress,
        selfieUrl: progress.selfie_path ? `/uploads/${path.basename(progress.selfie_path)}` : null,
        housePhotoUrl: progress.house_photo_path ? `/uploads/${path.basename(progress.house_photo_path)}` : null,
        streetPhotoUrl: progress.street_photo_path ? `/uploads/${path.basename(progress.street_photo_path)}` : null,
        landmarkPhotoUrl: progress.landmark_photo_path ? `/uploads/${path.basename(progress.landmark_photo_path)}` : null,
        doorPhotoUrl: progress.door_photo_path ? `/uploads/${path.basename(progress.door_photo_path)}` : null,
        jointSelfieUrl: progress.joint_selfie_path ? `/uploads/${path.basename(progress.joint_selfie_path)}` : null,
        documentUrl: progress.document_path ? `/uploads/${path.basename(progress.document_path)}` : null,
        documentBackUrl: progress.document_back_path ? `/uploads/${path.basename(progress.document_back_path)}` : null,
        documentOriginalName: progress.document_original_name || '',
        documentBackOriginalName: progress.document_back_original_name || '',
        documentType: progress.document_type || ''
      };
    }

    res.json({
      employee: {
        employeeId: req.employee.employee_id,
        employeeName: req.employee.employee_name,
        branch: req.employee.branch,
        department: req.employee.department,
        designation: req.employee.designation,
        dateOfJoining: req.employee.date_of_joining,
        hrAddress: req.employee.hr_current_address,
        hrLatitude: req.employee.hr_latitude,
        hrLongitude: req.employee.hr_longitude,
        status: req.employee.verification_status,
        teamLeader: req.employee.team_leader,
        caseReference: caseRec?.case_reference || `AV-${req.employee.employee_id}`
      },
      progress: formattedProgress
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve progress.' });
  }
});

// 3. POST /api/verify/save-details - Step 2: Confirm details
router.post('/save-details', authenticateEmployeeSession, async (req, res) => {
  try {
    const { confirmed, correctionRemark } = req.body;

    await query.run(
      `UPDATE verification_progress SET
        details_confirmed = ?,
        details_correction_remark = ?,
        current_step = MAX(current_step, 2),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [confirmed ? 1 : 0, correctionRemark || '', req.employee.employee_id]
    );

    // Update status to 'In Progress' if 'Not Started'
    if (req.employee.verification_status === 'Not Started') {
      await query.run(
        `UPDATE employees SET verification_status = 'In Progress', updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?`,
        [req.employee.employee_id]
      );
    }

    await recordVerificationAuditLog(
      req,
      'Details Confirmed',
      `Agent ${confirmed ? 'confirmed details' : 'reported details correction: ' + (correctionRemark || '')} [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({ success: true, message: 'Details step saved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save details confirmation.' });
  }
});

// 4. POST /api/verify/save-address - Step 3: Address Confirmation (Non-destructive)
router.post('/save-address', authenticateEmployeeSession, async (req, res) => {
  try {
    const { isSame, differenceReason, newAddress } = req.body;

    const submittedAddress = isSame ? req.employee.hr_current_address : (newAddress || '').trim();

    await query.run(
      `UPDATE verification_progress SET
        address_confirmed = 1,
        address_is_same = ?,
        address_difference_reason = ?,
        submitted_address = ?,
        current_step = MAX(current_step, 3),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [isSame ? 1 : 0, isSame ? '' : (differenceReason || ''), submittedAddress, req.employee.employee_id]
    );

    await recordVerificationAuditLog(
      req,
      'Address Confirmed',
      `Agent ${isSame ? 'confirmed HR current address' : 'reported different address: ' + submittedAddress + ' (' + (differenceReason || '') + ')'} [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({ success: true, submittedAddress });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save address details.' });
  }
});

// 5. POST /api/verify/save-residence - Step 4: Residence Details
router.post('/save-residence', authenticateEmployeeSession, async (req, res) => {
  try {
    const { residenceType, stayingSinceMonth, stayingSinceYear } = req.body;

    if (!residenceType || !stayingSinceMonth || !stayingSinceYear) {
      return res.status(400).json({ error: 'Please select residence type and staying since date.' });
    }

    await query.run(
      `UPDATE verification_progress SET
        residence_type = ?,
        staying_since_month = ?,
        staying_since_year = ?,
        current_step = MAX(current_step, 4),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [residenceType, stayingSinceMonth, stayingSinceYear, req.employee.employee_id]
    );

    await recordVerificationAuditLog(
      req,
      'Residence Details Saved',
      `Residence type: ${residenceType}, Staying since: ${stayingSinceMonth}/${stayingSinceYear} [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save residence details.' });
  }
});

// 6. POST /api/verify/save-location - Step 5: Live GPS Location Capture
router.post('/save-location', authenticateEmployeeSession, async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
    }

    // Haversine calculation against HR address coordinates (if present)
    let distanceMeters = null;
    let distanceCategory = 'No GPS Reference';

    if (req.employee.hr_latitude && req.employee.hr_longitude) {
      distanceMeters = calculateDistanceMeters(
        req.employee.hr_latitude,
        req.employee.hr_longitude,
        latitude,
        longitude
      );

      const classification = classifyDistance(
        distanceMeters,
        req.employee.hr_reference_type || 'STREET',
        accuracy || null,
        req.employee.hr_reference_quality || 'PRECISE'
      );
      distanceCategory = classification.category;
    }

    await query.run(
      `UPDATE verification_progress SET
        location_captured = 1,
        latitude = ?,
        longitude = ?,
        gps_accuracy = ?,
        distance_from_hr_meters = ?,
        distance_category = ?,
        current_step = MAX(current_step, 5),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [latitude, longitude, accuracy || null, distanceMeters, distanceCategory, req.employee.employee_id]
    );

    await recordVerificationAuditLog(
      req,
      'GPS Location Saved',
      `Captured GPS: Lat ${Number(latitude).toFixed(6)}, Lng ${Number(longitude).toFixed(6)} (±${accuracy || 5}m, ${distanceCategory}) [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({
      success: true,
      message: 'Location captured successfully.',
      latitude,
      longitude,
      accuracy,
      distanceMeters,
      distanceCategory
    });
  } catch (err) {
    console.error('Location save error:', err);
    res.status(500).json({ error: 'Failed to save location.' });
  }
});

// 6b. GET /api/verify/search-address - Address & Locality Geocoding Search for Map Placement
router.get('/search-address', authenticateEmployeeSession, async (req, res) => {
  try {
    const rawQuery = (req.query.query || req.query.q || '').trim();
    if (!rawQuery || rawQuery.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
    }

    let searchQuery = rawQuery;
    if (!searchQuery.toLowerCase().includes('india')) {
      searchQuery += ', India';
    }

    const results = [];

    // 1. Google Maps Geocoding if configured
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (googleApiKey && googleApiKey.trim().length > 0) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${encodeURIComponent(googleApiKey.trim())}&region=in`;
        const gRes = await fetch(url);
        const gData = await gRes.json();
        if (gData.status === 'OK' && Array.isArray(gData.results)) {
          for (const item of gData.results.slice(0, 5)) {
            if (item.geometry && item.geometry.location) {
              results.push({
                label: item.formatted_address,
                latitude: parseFloat(item.geometry.location.lat.toFixed(6)),
                longitude: parseFloat(item.geometry.location.lng.toFixed(6)),
                type: item.types?.[0] || 'address'
              });
            }
          }
        }
      } catch (gErr) {
        console.warn('[SEARCH-ADDRESS] Google Geocoding error:', gErr.message);
      }
    }

    // 2. OpenStreetMap / Nominatim Fallback
    if (results.length === 0) {
      try {
        const cleanQ = searchQuery.replace(/[#&]/g, ' ').replace(/\s+/g, ' ').trim();
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&countrycodes=in&q=${encodeURIComponent(cleanQ)}`;
        const nRes = await fetch(nomUrl, {
          headers: { 'User-Agent': 'CollmanAddressVerification/1.0 (internal-bgv@collman.com)' }
        });
        if (nRes.ok) {
          const nData = await nRes.json();
          if (Array.isArray(nData)) {
            for (const item of nData) {
              if (item.lat && item.lon) {
                results.push({
                  label: item.display_name,
                  latitude: parseFloat(parseFloat(item.lat).toFixed(6)),
                  longitude: parseFloat(parseFloat(item.lon).toFixed(6)),
                  type: item.type || item.category || 'place'
                });
              }
            }
          }
        }
      } catch (nErr) {
        console.warn('[SEARCH-ADDRESS] Nominatim search error:', nErr.message);
      }
    }

    res.json({
      success: true,
      query: rawQuery,
      results
    });
  } catch (err) {
    console.error('Search address endpoint error:', err);
    res.status(500).json({ error: 'Failed to search address.' });
  }
});

// 7. POST /api/verify/upload-landmark-photo - Step 6: Nearby Landmark Image
router.post('/upload-landmark-photo', authenticateEmployeeSession, async (req, res) => {
  try {
    if (!req.body.imageBase64) {
      return res.status(400).json({ error: 'Nearby landmark image data is required.' });
    }

    const buffer = getBufferFromBase64(req.body.imageBase64);
    const validation = await validateImage({
      imageBuffer: buffer,
      photoType: 'landmark',
      clientMetrics: req.body.clientMetrics || {},
      hrAddress: req.employee ? req.employee.hr_current_address : ''
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error || 'Nearby landmark validation failed. Please retake the photo.'
      });
    }

    const savedFile = saveBase64Image(req.body.imageBase64, `landmark_${req.employee.employee_id}`);
    const { latitude, longitude, accuracy, capturedAt } = req.body;
    const captureTimestamp = capturedAt || new Date().toISOString();

    await query.run(
      `UPDATE verification_progress SET
        landmark_photo_captured = 1,
        landmark_photo_path = ?,
        landmark_photo_latitude = ?,
        landmark_photo_longitude = ?,
        landmark_photo_accuracy = ?,
        landmark_photo_captured_at = ?,
        current_step = MAX(current_step, 6),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [
        savedFile.filePath,
        latitude !== undefined && latitude !== null ? Number(latitude) : null,
        longitude !== undefined && longitude !== null ? Number(longitude) : null,
        accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
        captureTimestamp,
        req.employee.employee_id
      ]
    );

    // Save individual photo GPS data separately into verification_evidence
    await recordPhotoEvidence({
      employeeId: req.employee.employee_id,
      evidenceType: 'landmark_photo',
      filePath: savedFile.filePath,
      mimeType: savedFile.mimeType,
      fileSize: savedFile.fileSize,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp,
      validationStatus: 'PASSED',
      validationReport: validation,
      tlId: req.tlId || req.employee.team_leader || null,
      tlName: req.tlName || req.employee.team_leader || null
    });

    await recordVerificationAuditLog(
      req,
      'Landmark Photo Uploaded',
      `Landmark photo captured successfully [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({
      success: true,
      message: 'Nearby landmark image captured successfully.',
      photoUrl: `/uploads/${savedFile.fileName}`,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp
    });
  } catch (err) {
    console.error('Landmark photo error:', err);
    res.status(500).json({ error: 'Photo could not be saved. Please try again.' });
  }
});

// 8. POST /api/verify/upload-street-photo - Step 7: Street Board Image
router.post('/upload-street-photo', authenticateEmployeeSession, async (req, res) => {
  try {
    if (!req.body.imageBase64) {
      return res.status(400).json({ error: 'Street board image data is required.' });
    }

    // Validate uploaded street photo strictly before saving
    const buffer = getBufferFromBase64(req.body.imageBase64);
    const validation = await validateImage({
      imageBuffer: buffer,
      photoType: 'street',
      clientMetrics: req.body.clientMetrics || {},
      hrAddress: req.employee ? req.employee.hr_current_address : ''
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error || 'Street board not detected or street name is not readable. Please retake the photo.'
      });
    }

    const savedFile = saveBase64Image(req.body.imageBase64, `street_${req.employee.employee_id}`);
    const { latitude, longitude, accuracy, capturedAt } = req.body;
    const captureTimestamp = capturedAt || new Date().toISOString();

    await query.run(
      `UPDATE verification_progress SET
        street_photo_captured = 1,
        street_photo_path = ?,
        street_photo_latitude = ?,
        street_photo_longitude = ?,
        street_photo_accuracy = ?,
        street_photo_captured_at = ?,
        current_step = MAX(current_step, 7),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [
        savedFile.filePath,
        latitude !== undefined && latitude !== null ? Number(latitude) : null,
        longitude !== undefined && longitude !== null ? Number(longitude) : null,
        accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
        captureTimestamp,
        req.employee.employee_id
      ]
    );

    // Save individual photo GPS data separately into verification_evidence
    await recordPhotoEvidence({
      employeeId: req.employee.employee_id,
      evidenceType: 'street_photo',
      filePath: savedFile.filePath,
      mimeType: savedFile.mimeType,
      fileSize: savedFile.fileSize,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp,
      validationStatus: 'PASSED',
      validationReport: validation,
      tlId: req.tlId || req.employee.team_leader || null,
      tlName: req.tlName || req.employee.team_leader || null
    });

    await recordVerificationAuditLog(
      req,
      'Street Photo Uploaded',
      `Street board photo captured successfully [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({
      success: true,
      message: 'Street board image captured successfully.',
      photoUrl: `/uploads/${savedFile.fileName}`,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp
    });
  } catch (err) {
    console.error('Street photo error:', err);
    res.status(500).json({ error: 'Photo could not be saved. Please try again.' });
  }
});

// 9. POST /api/verify/upload-house-photo - Step 8: House / Building Photo
router.post('/upload-house-photo', authenticateEmployeeSession, async (req, res) => {
  try {
    if (!req.body.imageBase64) {
      return res.status(400).json({ error: 'House photo image data is required.' });
    }

    const buffer = getBufferFromBase64(req.body.imageBase64);
    const validation = await validateImage({
      imageBuffer: buffer,
      photoType: 'building',
      clientMetrics: req.body.clientMetrics || {},
      hrAddress: req.employee ? req.employee.hr_current_address : ''
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error || 'Full building validation failed. Please retake the photo.'
      });
    }

    const savedFile = saveBase64Image(req.body.imageBase64, `house_${req.employee.employee_id}`);
    const { latitude, longitude, accuracy, capturedAt } = req.body;
    const captureTimestamp = capturedAt || new Date().toISOString();

    await query.run(
      `UPDATE verification_progress SET
        house_photo_captured = 1,
        house_photo_path = ?,
        house_photo_latitude = ?,
        house_photo_longitude = ?,
        house_photo_accuracy = ?,
        house_photo_captured_at = ?,
        current_step = MAX(current_step, 8),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [
        savedFile.filePath,
        latitude !== undefined && latitude !== null ? Number(latitude) : null,
        longitude !== undefined && longitude !== null ? Number(longitude) : null,
        accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
        captureTimestamp,
        req.employee.employee_id
      ]
    );

    // Save individual photo GPS data separately into verification_evidence
    await recordPhotoEvidence({
      employeeId: req.employee.employee_id,
      evidenceType: 'house_photo',
      filePath: savedFile.filePath,
      mimeType: savedFile.mimeType,
      fileSize: savedFile.fileSize,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp,
      validationStatus: 'PASSED',
      validationReport: validation,
      tlId: req.tlId || req.employee.team_leader || null,
      tlName: req.tlName || req.employee.team_leader || null
    });

    await recordVerificationAuditLog(
      req,
      'House Photo Uploaded',
      `Full building / house photo captured successfully [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({
      success: true,
      message: 'House photo captured successfully.',
      photoUrl: `/uploads/${savedFile.fileName}`,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp
    });
  } catch (err) {
    console.error('House photo error:', err);
    res.status(500).json({ error: 'Photo could not be saved. Please try again.' });
  }
});

// 10. POST /api/verify/validate-image - Automatic Quality & Content Image Validation
router.post('/validate-image', authenticateEmployeeSession, async (req, res) => {
  try {
    const { imageBase64, photoType, clientMetrics, hrAddress: clientHrAddress } = req.body || {};
    if (!imageBase64) {
      return res.json({
        valid: false,
        error: 'Unable to analyze photo. Please retake the photo.',
        checks: {
          clarity: { passed: false, message: 'Image data missing' },
          lighting: { passed: false, message: 'Image data missing' },
          visibility: { passed: false, message: 'Image data missing' },
          content: { passed: false, message: 'Unable to analyze photo' }
        }
      });
    }

    const buffer = getBufferFromBase64(imageBase64);
    const hrAddress = req.employee ? req.employee.hr_current_address : (clientHrAddress || '');
    const report = await validateImage({
      imageBuffer: buffer,
      photoType,
      clientMetrics: clientMetrics || {},
      hrAddress
    });

    res.json(report);
  } catch (err) {
    console.error('Image validation error:', err);
    res.json({
      valid: false,
      error: 'Unable to analyze photo. Please retake the photo.',
      checks: {
        clarity: { passed: false, message: 'Analysis failed' },
        lighting: { passed: false, message: 'Analysis failed' },
        visibility: { passed: false, message: 'Analysis failed' },
        content: { passed: false, message: 'Unable to analyze photo' }
      }
    });
  }
});

// 11. POST /api/verify/upload-door-photo - Step 9: Door Number Selfie
router.post('/upload-door-photo', authenticateEmployeeSession, async (req, res) => {
  try {
    if (!req.body.imageBase64) {
      return res.status(400).json({ error: 'Door number selfie image data is required.' });
    }

    const buffer = getBufferFromBase64(req.body.imageBase64);
    const validation = await validateImage({
      imageBuffer: buffer,
      photoType: 'door_selfie',
      clientMetrics: req.body.clientMetrics || {},
      hrAddress: req.employee ? req.employee.hr_current_address : ''
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error || 'Door number selfie validation failed. Please retake the photo.'
      });
    }

    const savedFile = saveBase64Image(req.body.imageBase64, `door_${req.employee.employee_id}`);
    const { latitude, longitude, accuracy, capturedAt } = req.body;
    const captureTimestamp = capturedAt || new Date().toISOString();

    await query.run(
      `UPDATE verification_progress SET
        door_photo_captured = 1,
        door_photo_path = ?,
        door_photo_latitude = ?,
        door_photo_longitude = ?,
        door_photo_accuracy = ?,
        door_photo_captured_at = ?,
        current_step = MAX(current_step, 9),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [
        savedFile.filePath,
        latitude !== undefined && latitude !== null ? Number(latitude) : null,
        longitude !== undefined && longitude !== null ? Number(longitude) : null,
        accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
        captureTimestamp,
        req.employee.employee_id
      ]
    );

    // Save individual photo GPS data separately into verification_evidence
    await recordPhotoEvidence({
      employeeId: req.employee.employee_id,
      evidenceType: 'door_photo',
      filePath: savedFile.filePath,
      mimeType: savedFile.mimeType,
      fileSize: savedFile.fileSize,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp,
      validationStatus: 'PASSED',
      validationReport: validation,
      tlId: req.tlId || req.employee.team_leader || null,
      tlName: req.tlName || req.employee.team_leader || null
    });

    await recordVerificationAuditLog(
      req,
      'Door Photo Uploaded',
      `Door number selfie captured successfully [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({
      success: true,
      message: 'Door number selfie captured successfully.',
      photoUrl: `/uploads/${savedFile.fileName}`,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp
    });
  } catch (err) {
    console.error('Door photo upload error:', err);
    res.status(500).json({ error: 'Photo could not be saved. Please try again.' });
  }
});

// 12. POST /api/verify/upload-selfie - Step 10: Live Selfie
router.post('/upload-selfie', authenticateEmployeeSession, async (req, res) => {
  try {
    if (!req.body.imageBase64) {
      return res.status(400).json({ error: 'Selfie image data is required.' });
    }

    const buffer = getBufferFromBase64(req.body.imageBase64);
    const validation = await validateImage({
      imageBuffer: buffer,
      photoType: 'selfie',
      clientMetrics: req.body.clientMetrics || {},
      hrAddress: req.employee ? req.employee.hr_current_address : ''
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error || 'Live selfie validation failed. Please retake the photo.'
      });
    }

    const savedFile = saveBase64Image(req.body.imageBase64, `selfie_${req.employee.employee_id}`);
    const { latitude, longitude, accuracy, capturedAt } = req.body;
    const captureTimestamp = capturedAt || new Date().toISOString();

    await query.run(
      `UPDATE verification_progress SET
        selfie_captured = 1,
        selfie_path = ?,
        selfie_latitude = ?,
        selfie_longitude = ?,
        selfie_accuracy = ?,
        selfie_captured_at = ?,
        current_step = MAX(current_step, 10),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [
        savedFile.filePath,
        latitude !== undefined && latitude !== null ? Number(latitude) : null,
        longitude !== undefined && longitude !== null ? Number(longitude) : null,
        accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
        captureTimestamp,
        req.employee.employee_id
      ]
    );

    // Save individual photo GPS data separately into verification_evidence
    await recordPhotoEvidence({
      employeeId: req.employee.employee_id,
      evidenceType: 'selfie',
      filePath: savedFile.filePath,
      mimeType: savedFile.mimeType,
      fileSize: savedFile.fileSize,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp,
      validationStatus: 'PASSED',
      validationReport: validation,
      tlId: req.tlId || req.employee.team_leader || null,
      tlName: req.tlName || req.employee.team_leader || null
    });

    await recordVerificationAuditLog(
      req,
      'Selfie Uploaded',
      `Live selfie photo captured successfully [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({
      success: true,
      message: 'Selfie captured successfully.',
      photoUrl: `/uploads/${savedFile.fileName}`,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp
    });
  } catch (err) {
    console.error('Selfie upload error:', err);
    res.status(500).json({ error: 'Photo could not be saved. Please try again.' });
  }
});

// 12A. GET /api/verify/tl-list - List active Team Leaders for joint verification
router.get('/tl-list', authenticateEmployeeSession, async (req, res) => {
  try {
    const tls = await query.all(
      `SELECT id, username, full_name, email, branch
       FROM users
       WHERE (role = 'Team Leader' OR role = 'Super Admin' OR role = 'HR/Admin')
       AND is_active = 1
       ORDER BY full_name ASC`
    );
    res.json({ success: true, teamLeaders: tls });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve team leaders list.' });
  }
});

// 12B. POST /api/verify/upload-joint-selfie - Mandatory Step: TL & Employee Joint Selfie
router.post('/upload-joint-selfie', authenticateEmployeeSession, async (req, res) => {
  try {
    const rawImage = req.body.imageBase64 || req.body.image;
    if (!rawImage) {
      return res.status(400).json({ error: 'TL & Employee Joint Selfie image data is required.' });
    }

    const { latitude, longitude, accuracy, capturedAt, tlId, tlName, clientMetrics } = req.body;
    const captureTimestamp = capturedAt || new Date().toISOString();

    // 1. Strict Two-Face & Quality Validation
    const buffer = getBufferFromBase64(rawImage);
    const validation = await validateImage({
      imageBuffer: buffer,
      photoType: 'joint_selfie',
      clientMetrics: clientMetrics || {},
      hrAddress: req.employee ? req.employee.hr_current_address : ''
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error || 'TL & Employee Joint Selfie validation failed. Both faces must be clearly visible.'
      });
    }

    // 2. Resolve / Authenticate Team Leader identity
    let resolvedTlId = (tlId || '').trim();
    let resolvedTlName = (tlName || '').trim();

    if (resolvedTlId || resolvedTlName) {
      const tlUser = await query.get(
        `SELECT id, username, full_name FROM users
         WHERE (username = ? OR id = ? OR full_name = ?)
         AND (role = 'Team Leader' OR role = 'Super Admin' OR role = 'HR/Admin')`,
        [resolvedTlId, resolvedTlId, resolvedTlName]
      );
      if (tlUser) {
        resolvedTlId = tlUser.username || String(tlUser.id);
        resolvedTlName = tlUser.full_name;
      }
    }

    if (!resolvedTlId && req.tlId) {
      resolvedTlId = req.tlId;
      resolvedTlName = req.tlName || req.employee?.team_leader || req.tlId;
    }

    if (!resolvedTlId && req.employee?.team_leader) {
      resolvedTlName = req.employee.team_leader;
      const matchedUser = await query.get(
        `SELECT id, username, full_name FROM users
         WHERE (full_name = ? OR username = ?)
         AND (role = 'Team Leader' OR role = 'Super Admin' OR role = 'HR/Admin')`,
        [req.employee.team_leader, req.employee.team_leader]
      );
      if (matchedUser) {
        resolvedTlId = matchedUser.username || String(matchedUser.id);
        resolvedTlName = matchedUser.full_name;
      }
    }

    const savedFile = saveBase64Image(rawImage, `joint_selfie_${req.employee.employee_id}`);

    // 3. Update verification progress
    await query.run(
      `UPDATE verification_progress SET
        joint_selfie_captured = 1,
        joint_selfie_path = ?,
        joint_selfie_latitude = ?,
        joint_selfie_longitude = ?,
        joint_selfie_accuracy = ?,
        joint_selfie_captured_at = ?,
        joint_selfie_tl_id = ?,
        joint_selfie_tl_name = ?,
        tl_id = COALESCE(?, tl_id),
        tl_name = COALESCE(?, tl_name),
        current_step = MAX(current_step, 12),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [
        savedFile.filePath,
        latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null,
        longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null,
        accuracy !== undefined && accuracy !== null && accuracy !== '' ? Number(accuracy) : null,
        captureTimestamp,
        resolvedTlId || null,
        resolvedTlName || null,
        resolvedTlId || null,
        resolvedTlName || null,
        req.employee.employee_id
      ]
    );

    // 4. Save individual photo GPS data & TL details into verification_evidence
    await recordPhotoEvidence({
      employeeId: req.employee.employee_id,
      evidenceType: 'joint_selfie',
      filePath: savedFile.filePath,
      mimeType: savedFile.mimeType,
      fileSize: savedFile.fileSize,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp,
      validationStatus: 'PASSED',
      validationReport: validation,
      tlId: resolvedTlId || null,
      tlName: resolvedTlName || null
    });

    // 5. Audit timeline entry
    const caseRec = await query.get('SELECT case_reference, current_attempt_number FROM verification_cases WHERE employee_id = ?', [req.employee.employee_id]);
    const attemptNo = caseRec?.current_attempt_number || 1;
    const caseRef = caseRec?.case_reference || `AV-${req.employee.employee_id}`;

    await query.run(
      `INSERT INTO verification_timeline (
        employee_id, case_reference, attempt_number, action, actor_type, actor_name, details, tl_id
      ) VALUES (?, ?, ?, 'TL & Employee Joint Selfie Captured', 'Team Leader', ?, ?, ?)`,
      [
        req.employee.employee_id,
        caseRef,
        attemptNo,
        resolvedTlName || 'Assigned Team Leader',
        `TL & Employee joint selfie captured. Authenticated TL ID: ${resolvedTlId || 'N/A'}, TL Name: ${resolvedTlName || 'N/A'}. GPS: Lat ${Number(latitude || 0).toFixed(6)}, Lng ${Number(longitude || 0).toFixed(6)} (±${accuracy || 5}m)`,
        resolvedTlId || null
      ]
    );

    await recordVerificationAuditLog(
      req,
      'TL Joint Selfie Uploaded',
      `TL & Employee joint selfie captured with Team Leader ${resolvedTlName || 'Assigned TL'} (${resolvedTlId || 'N/A'}) [Agent: ${req.employee.employee_id}, TL: ${resolvedTlId || req.tlId || 'N/A'}]`
    );

    res.json({
      success: true,
      message: 'TL & Employee Joint Selfie captured successfully.',
      photoUrl: `/uploads/${savedFile.fileName}`,
      latitude,
      longitude,
      accuracy,
      capturedAt: captureTimestamp,
      tlId: resolvedTlId,
      tlName: resolvedTlName
    });
  } catch (err) {
    console.error('Joint selfie upload error:', err);
    res.status(500).json({ error: 'Joint selfie could not be saved. Please try again.' });
  }
});

// 12C. POST /api/verify/validate-address-proof - Real-time Document Type & Quality Validation
router.post('/validate-address-proof', authenticateEmployeeSession, upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'front', maxCount: 1 },
  { name: 'back', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      documentType,
      side = 'both',
      frontBase64,
      backBase64,
      frontMetrics,
      backMetrics
    } = req.body;

    let parsedFrontMetrics = {};
    let parsedBackMetrics = {};
    try {
      if (frontMetrics) parsedFrontMetrics = typeof frontMetrics === 'string' ? JSON.parse(frontMetrics) : frontMetrics;
      if (backMetrics) parsedBackMetrics = typeof backMetrics === 'string' ? JSON.parse(backMetrics) : backMetrics;
    } catch (e) {}

    let frontFileOrBuffer = null;
    if (req.files && (req.files['front']?.[0] || req.files['document']?.[0])) {
      frontFileOrBuffer = (req.files['front']?.[0] || req.files['document']?.[0]).path;
    } else if (frontBase64) {
      frontFileOrBuffer = frontBase64;
    }

    let backFileOrBuffer = null;
    if (req.files && req.files['back']?.[0]) {
      backFileOrBuffer = req.files['back'][0].path;
    } else if (backBase64) {
      backFileOrBuffer = backBase64;
    }

    const employee = await query.get('SELECT * FROM employees WHERE employee_id = ?', [req.employee.employee_id]);
    const progress = await query.get('SELECT * FROM verification_progress WHERE employee_id = ?', [req.employee.employee_id]);

    const hrAddress = employee?.hr_current_address || '';
    const empConfirmedAddress = progress?.submitted_address || hrAddress;
    const hrName = employee?.employee_name || '';
    const empConfirmedName = progress?.submitted_name || hrName;
    const docType = documentType || req.body.selectedType;
    const frontText = req.body.frontText || req.body.frontData?.text || '';
    const backText = req.body.backText || req.body.backData?.text || '';

    const validation = await validateAddressProofDocument({
      frontFileOrBuffer,
      backFileOrBuffer,
      frontText,
      backText,
      selectedDocumentType: docType,
      frontMetrics: parsedFrontMetrics,
      backMetrics: parsedBackMetrics,
      hrAddress,
      employeeConfirmedAddress: empConfirmedAddress,
      hrName,
      employeeConfirmedName: empConfirmedName,
      validateSide: side
    });

    res.json({
      success: true,
      data: validation,
      ...validation
    });
  } catch (err) {
    console.error('Validation route error:', err);
    res.status(500).json({
      valid: false,
      error: err.message || 'Validation failed. Please check document quality and try again.'
    });
  }
});

// 13. POST /api/verify/upload-document - Step 11: Address Proof Document (Front + Back)
router.post('/upload-document', authenticateEmployeeSession, upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'front', maxCount: 1 },
  { name: 'back', maxCount: 1 }
]), async (req, res) => {
  try {
    const { documentType, frontBase64, backBase64 } = req.body;

    if (!documentType) {
      return res.status(400).json({ error: 'Please select an address proof document type.' });
    }

    // Resolve Front Document / Photo
    let frontInfo = null;
    if (req.files && (req.files['front']?.[0] || req.files['document']?.[0])) {
      const file = req.files['front']?.[0] || req.files['document']?.[0];
      frontInfo = {
        filePath: file.path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileUrl: `/uploads/${file.filename}`
      };
    } else if (frontBase64) {
      const saved = saveBase64Image(frontBase64, `doc_front_${req.employee.employee_id}`);
      frontInfo = {
        filePath: saved.filePath,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        fileUrl: `/uploads/${saved.fileName}`
      };
    }

    // Resolve Back Document / Photo
    let backInfo = null;
    if (req.files && req.files['back']?.[0]) {
      const file = req.files['back'][0];
      backInfo = {
        filePath: file.path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileUrl: `/uploads/${file.filename}`
      };
    } else if (backBase64) {
      const saved = saveBase64Image(backBase64, `doc_back_${req.employee.employee_id}`);
      backInfo = {
        filePath: saved.filePath,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        fileUrl: `/uploads/${saved.fileName}`
      };
    }

    // If either side wasn't provided in this request, check existing progress
    if (!frontInfo || !backInfo) {
      const currentProgress = await query.get(
        'SELECT document_path, document_original_name, document_back_path, document_back_original_name FROM verification_progress WHERE employee_id = ?',
        [req.employee.employee_id]
      );
      if (!frontInfo && currentProgress?.document_path) {
        frontInfo = {
          filePath: currentProgress.document_path,
          fileName: currentProgress.document_original_name || 'Front_Document',
          fileUrl: `/uploads/${path.basename(currentProgress.document_path)}`
        };
      }
      if (!backInfo && currentProgress?.document_back_path) {
        backInfo = {
          filePath: currentProgress.document_back_path,
          fileName: currentProgress.document_back_original_name || 'Back_Document',
          fileUrl: `/uploads/${path.basename(currentProgress.document_back_path)}`
        };
      }
    }

    if (!frontInfo) {
      return res.status(400).json({ error: 'Please provide the FRONT SIDE of the address proof document.' });
    }

    if (!backInfo) {
      return res.status(400).json({ error: 'Please provide the BACK SIDE of the address proof document.' });
    }

    await query.run(
      `UPDATE verification_progress SET
        address_proof_uploaded = 1,
        document_type = ?,
        document_path = ?,
        document_original_name = ?,
        document_back_path = ?,
        document_back_original_name = ?,
        current_step = MAX(current_step, 11),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [
        documentType,
        frontInfo.filePath,
        frontInfo.fileName,
        backInfo.filePath,
        backInfo.fileName,
        req.employee.employee_id
      ]
    );

    // Save to evidence table with TL ID and Name
    await query.run(
      `INSERT INTO verification_evidence (
        employee_id, evidence_type, document_type, file_path, original_filename, mime_type, file_size, tl_id, tl_name
      ) VALUES (?, 'address_proof', ?, ?, ?, ?, ?, ?, ?)`,
      [req.employee.employee_id, `${documentType} (Front)`, frontInfo.filePath, frontInfo.fileName, frontInfo.mimeType || 'application/octet-stream', frontInfo.fileSize || 0, req.tlId || req.employee.team_leader || null, req.tlName || req.employee.team_leader || null]
    );

    await query.run(
      `INSERT INTO verification_evidence (
        employee_id, evidence_type, document_type, file_path, original_filename, mime_type, file_size, tl_id, tl_name
      ) VALUES (?, 'address_proof', ?, ?, ?, ?, ?, ?, ?)`,
      [req.employee.employee_id, `${documentType} (Back)`, backInfo.filePath, backInfo.fileName, backInfo.mimeType || 'application/octet-stream', backInfo.fileSize || 0, req.tlId || req.employee.team_leader || null, req.tlName || req.employee.team_leader || null]
    );

    await recordVerificationAuditLog(
      req,
      'Address Proof Uploaded',
      `Address proof ${documentType} uploaded (Front & Back) [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({
      success: true,
      message: 'Front and Back address proof uploaded successfully.',
      documentType,
      fileName: frontInfo.fileName,
      fileUrl: frontInfo.fileUrl,
      backFileName: backInfo.fileName,
      backFileUrl: backInfo.fileUrl
    });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ error: err.message || 'Document upload failed. Please try again.' });
  }
});

// 14. POST /api/verify/save-declaration - Step 12: Accept Declaration
router.post('/save-declaration', authenticateEmployeeSession, async (req, res) => {
  try {
    const { accepted } = req.body;

    if (!accepted) {
      return res.status(400).json({ error: 'You must accept the declaration to continue.' });
    }

    await query.run(
      `UPDATE verification_progress SET
        declaration_accepted = 1,
        declaration_timestamp = CURRENT_TIMESTAMP,
        current_step = MAX(current_step, 12),
        last_saved_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [req.employee.employee_id]
    );

    await recordVerificationAuditLog(
      req,
      'Declaration Accepted',
      `Legal declaration accepted by Agent [Agent: ${req.employee.employee_id}, TL: ${req.tlId || req.employee.team_leader || 'N/A'}]`
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record declaration.' });
  }
});

// 11. POST /api/verify/submit - Step 10: Final Verification Submission
router.post('/submit', authenticateEmployeeSession, async (req, res) => {
  try {
    const empId = req.employee.employee_id;
    const attemptNo = req.attemptNumber || 1;
    const tlId = req.tlId || req.employee.team_leader || null;
    const tlName = req.tlName || req.employee.team_leader || null;

    // Load full progress record
    const progress = await query.get(
      'SELECT * FROM verification_progress WHERE employee_id = ?',
      [empId]
    );

    if (!progress) {
      return res.status(400).json({ error: 'No verification data found to submit.' });
    }

    // Validation checks for required elements
    const missing = [];
    if (!progress.details_confirmed) missing.push('Employee Details Confirmation');
    if (!progress.address_confirmed) missing.push('Address Confirmation');
    if (!progress.residence_type) missing.push('Residence Details');
    if (!progress.location_captured) missing.push('Live Location Capture');
    if (!progress.selfie_captured) missing.push('Live Selfie');
    if (!progress.house_photo_captured) missing.push('Full Building Photo');
    if (!progress.door_photo_captured) missing.push('Door Number Selfie');
    if (!progress.street_photo_captured) missing.push('Street Board Image');
    if (!progress.landmark_photo_captured) missing.push('Nearby Landmark Image');
    if (!progress.address_proof_uploaded) missing.push('Address Proof Document');
    if (!progress.joint_selfie_captured) missing.push('TL & Employee Joint Selfie');
    if (!progress.declaration_accepted) missing.push('Employee Declaration');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Please complete the following mandatory steps before submitting: ${missing.join(', ')}`
      });
    }

    // Verify that all 6 required photo evidence items exist and passed automated validation
    const requiredEvidenceTypes = [
      { type: 'selfie', name: 'Live Selfie' },
      { type: 'house_photo', name: 'Full Building Photo' },
      { type: 'door_photo', name: 'Door Number Selfie' },
      { type: 'street_photo', name: 'Street Board Image' },
      { type: 'landmark_photo', name: 'Nearby Landmark Image' },
      { type: 'joint_selfie', name: 'TL & Employee Joint Selfie' }
    ];

    const passedEvidence = await query.all(
      `SELECT evidence_type, validation_status FROM verification_evidence
       WHERE employee_id = ? AND attempt_number = ? AND validation_status = 'PASSED'`,
      [empId, attemptNo]
    );

    const passedTypes = new Set(passedEvidence.map(e => e.evidence_type));
    const unverifiedPhotos = requiredEvidenceTypes
      .filter(item => !passedTypes.has(item.type))
      .map(item => item.name);

    if (unverifiedPhotos.length > 0) {
      return res.status(400).json({
        error: `Mandatory photo validation incomplete. The following photos must successfully pass automated validation before submission: ${unverifiedPhotos.join(', ')}.`
      });
    }

    // Check if case already exists for this employee
    const year = new Date().getFullYear();
    let caseRecord = await query.get('SELECT id, case_reference, current_attempt_number FROM verification_cases WHERE employee_id = ?', [empId]);
    let caseId;
    let referenceNo;

    if (caseRecord && caseRecord.case_reference) {
      referenceNo = caseRecord.case_reference;
    } else {
      // Find the highest sequence number for the current year to guarantee strict uniqueness
      const casesThisYear = await query.all(
        "SELECT case_reference FROM verification_cases WHERE case_reference LIKE ?",
        [`AV-${year}-%`]
      );

      let maxSeq = 0;
      casesThisYear.forEach((c) => {
        if (c.case_reference) {
          const parts = c.case_reference.split('-');
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      });

      let nextSeq = maxSeq + 1;
      let candidate = `AV-${year}-${String(nextSeq).padStart(6, '0')}`;

      // Double-check against collision
      let existingRef = await query.get('SELECT id FROM verification_cases WHERE case_reference = ?', [candidate]);
      while (existingRef) {
        nextSeq++;
        candidate = `AV-${year}-${String(nextSeq).padStart(6, '0')}`;
        existingRef = await query.get('SELECT id FROM verification_cases WHERE case_reference = ?', [candidate]);
      }
      referenceNo = candidate;
    }

    // Get TAT setting
    const tatSetting = await query.get("SELECT value FROM app_settings WHERE key='bgv_tat_days'");
    const bgvTatDays = parseInt(tatSetting ? tatSetting.value : '1', 10);

    // Create or update verification case with tl_id and tl_name
    if (!caseRecord) {
      const caseResult = await query.run(
        `INSERT INTO verification_cases (
          case_reference, employee_id, current_attempt_number, status,
          tat_deadline, created_at, updated_at, tl_id, tl_name
        ) VALUES (?, ?, ?, 'Pending BGV Review', datetime('now', '+' || ? || ' days'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)`,
        [referenceNo, empId, attemptNo, bgvTatDays, tlId, tlName]
      );
      caseId = caseResult.lastID;
    } else {
      caseId = caseRecord.id;
      await query.run(
        `UPDATE verification_cases SET
          case_reference = ?,
          current_attempt_number = ?,
          status = 'Pending BGV Review',
          tat_deadline = datetime('now', '+' || ? || ' days'),
          tl_id = COALESCE(?, tl_id),
          tl_name = COALESCE(?, tl_name),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [referenceNo, attemptNo, bgvTatDays, tlId, tlName, caseId]
      );
    }

    // Insert or update attempt record with tl_id and tl_name
    const existingAttempt = await query.get(
      'SELECT id FROM verification_attempts WHERE case_id = ? AND attempt_number = ?',
      [caseId, attemptNo]
    );

    if (existingAttempt) {
      await query.run(
        `UPDATE verification_attempts SET
           status = 'Submitted',
           submitted_at = CURRENT_TIMESTAMP,
           tl_id = COALESCE(?, tl_id),
           tl_name = COALESCE(?, tl_name)
         WHERE id = ?`,
        [tlId, tlName, existingAttempt.id]
      );
    } else {
      await query.run(
        `INSERT INTO verification_attempts (
          case_id, employee_id, attempt_number, status, started_at, submitted_at, tl_id, tl_name
        ) VALUES (?, ?, ?, 'Submitted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)`,
        [caseId, empId, attemptNo, tlId, tlName]
      );
    }

    // Associate all evidence records for this attempt with the confirmed caseId
    await query.run(
      'UPDATE verification_evidence SET case_id = ? WHERE employee_id = ? AND attempt_number = ?',
      [caseId, empId, attemptNo]
    );

    // Ensure address proof is recorded in verification_evidence if uploaded
    if (progress.document_path) {
      const existingDoc = await query.get(
        "SELECT id FROM verification_evidence WHERE employee_id = ? AND attempt_number = ? AND evidence_type = 'address_proof'",
        [empId, attemptNo]
      );
      if (!existingDoc) {
        await query.run(
          `INSERT INTO verification_evidence (case_id, attempt_number, employee_id, evidence_type, document_type, file_path, original_filename, validation_status, tl_id, tl_name)
           VALUES (?, ?, ?, 'address_proof', ?, ?, ?, 'PASSED', ?, ?)`,
          [caseId, attemptNo, empId, progress.document_type, progress.document_path, progress.document_original_name, tlId, tlName]
        );
      }
    }

    // Update employee master status to 'Pending BGV Review' (HR address left completely untouched!)
    await query.run(
      `UPDATE employees SET
        verification_status = 'Pending BGV Review',
        updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [empId]
    );

    // Timeline record with tl_id
    await query.run(
      `INSERT INTO verification_timeline (employee_id, case_reference, attempt_number, action, actor_type, actor_name, details, tl_id)
       VALUES (?, ?, ?, 'Verification Submitted', 'Employee', ?, ?, ?)`,
      [
        empId,
        referenceNo,
        attemptNo,
        req.employee.employee_name,
        `Verification submitted successfully by Agent ${empId} (${req.employee.employee_name}) under Team Leader ${tlName || tlId || 'Assigned TL'} (${tlId || 'N/A'}). Reference: ${referenceNo} (Attempt ${attemptNo})`,
        tlId
      ]
    );

    // System audit log recording Agent ID and TL ID
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_name, action, employee_id, agent_id, tl_id, case_reference, ip_address, details)
       VALUES ('Employee', ?, 'Verification Submitted', ?, ?, ?, ?, ?, ?)`,
      [
        req.employee.employee_name,
        empId,
        empId,
        tlId,
        referenceNo,
        req.ip,
        `Agent ${empId} (${req.employee.employee_name}) completed all verification steps under Team Leader ${tlName || tlId || 'Assigned TL'} (${tlId || 'N/A'})`
      ]
    );

    res.json({
      success: true,
      referenceNo,
      message: 'Address Verification Submitted Successfully',
      submissionTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('Final submit error:', err);
    res.status(500).json({ error: 'Submission failed. Please try again.' });
  }
});

module.exports = router;
