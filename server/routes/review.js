const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { query } = require('../db/database');
const { authenticateAdmin, requireRoles } = require('../middleware/auth');
const { generateVerificationReportPDF } = require('../utils/pdfGenerator');
const {
  calculateDistanceMeters,
  formatDistance,
  classifyDistance,
  geocodeAddress
} = require('../utils/geoUtils');
const { processSingleEmployee } = require('../utils/geocodingQueue');
const { performDocumentAddressMatch } = require('../utils/documentAddressMatcher');

// Helper to format evidence paths to relative URLs
function formatFileUrl(filePath) {
  if (!filePath) return null;
  return `/uploads/${path.basename(filePath)}`;
}

// Helper to extract rich metadata for address proof documents (PDF / Images)
function getDocMeta(filePath) {
  if (!filePath) return null;
  let fullPath = filePath;
  if (!fs.existsSync(fullPath)) {
    fullPath = path.join(__dirname, '..', filePath.replace(/^.*[\\\/]uploads[\\\/]/, 'uploads/'));
  }
  if (!fs.existsSync(fullPath)) {
    const baseName = path.basename(filePath);
    fullPath = path.join(__dirname, '..', 'uploads', baseName);
  }
  if (!fs.existsSync(fullPath)) return null;
  try {
    const stat = fs.statSync(fullPath);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex').substring(0, 16).toUpperCase();
    const isPdf = fullPath.toLowerCase().endsWith('.pdf');
    return {
      fileName: path.basename(filePath),
      fileSize: `${(stat.size / 1024).toFixed(1)} KB`,
      fileSizeBytes: stat.size,
      isPdf,
      fileType: isPdf ? 'PDF (Electronic Document)' : 'Image (Raster)',
      uploadedAt: stat.mtime,
      hash
    };
  } catch (e) {
    return null;
  }
}

// GET /api/review/:caseRefOrEmpId - Fetch comprehensive case review package
router.get('/:caseRefOrEmpId', authenticateAdmin, async (req, res) => {
  try {
    const { caseRefOrEmpId } = req.params;

    // Fetch employee
    const employee = await query.get(
      `SELECT e.*, u.full_name as assigned_reviewer_name
       FROM employees e
       LEFT JOIN users u ON e.assigned_reviewer_id = u.id
       WHERE e.employee_id = ? OR e.employee_id IN (SELECT employee_id FROM verification_cases WHERE case_reference = ?)`,
      [caseRefOrEmpId, caseRefOrEmpId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Verification case or employee not found.' });
    }

    const empId = employee.employee_id;

    // Fetch case record
    const caseRecord = await query.get(
      `SELECT vc.*, u.full_name as reviewer_name
       FROM verification_cases vc
       LEFT JOIN users u ON vc.assigned_reviewer_id = u.id
       WHERE vc.employee_id = ?`,
      [empId]
    );

    // Fetch current progress / verification submission
    const progress = await query.get(
      'SELECT * FROM verification_progress WHERE employee_id = ?',
      [empId]
    );

    // Fetch attempts
    const attempts = await query.all(
      `SELECT va.*, u.full_name as reviewer_name
       FROM verification_attempts va
       LEFT JOIN users u ON va.reviewer_id = u.id
       WHERE va.employee_id = ?
       ORDER BY va.attempt_number ASC`,
      [empId]
    );

    // Fetch timeline
    const timeline = await query.all(
      'SELECT * FROM verification_timeline WHERE employee_id = ? ORDER BY created_at ASC',
      [empId]
    );

    // Fetch evidence (prioritize latest attempt and most recent captures first)
    const rawEvidence = await query.all(
      'SELECT * FROM verification_evidence WHERE employee_id = ? ORDER BY attempt_number DESC, captured_at DESC, id DESC',
      [empId]
    );

    const evidence = rawEvidence.map((ev) => ({
      ...ev,
      fileUrl: formatFileUrl(ev.file_path)
    }));

    // Format photo URLs and file metadata in progress
    const formattedProgress = progress
      ? {
          ...progress,
          selfieUrl: formatFileUrl(progress.selfie_path),
          housePhotoUrl: formatFileUrl(progress.house_photo_path),
          doorPhotoUrl: formatFileUrl(progress.door_photo_path),
          entrancePhotoUrl: formatFileUrl(progress.entrance_photo_path),
          streetPhotoUrl: formatFileUrl(progress.street_photo_path),
          landmarkPhotoUrl: formatFileUrl(progress.landmark_photo_path),
          documentUrl: formatFileUrl(progress.document_path),
          documentBackUrl: formatFileUrl(progress.document_back_path),
          documentMeta: getDocMeta(progress.document_path),
          documentBackMeta: getDocMeta(progress.document_back_path)
        }
      : null;

    // Automatic Address Proof Document Address Matching
    let documentAddressMatch = null;
    if (progress && progress.document_path) {
      try {
        documentAddressMatch = await performDocumentAddressMatch(employee, progress);
      } catch (docErr) {
        console.warn('Document address match error in review endpoint:', docErr.message);
      }
    }

    res.json({
      employee,
      caseRecord: caseRecord || {
        case_reference: `AV-${empId}`,
        status: employee.verification_status,
        current_attempt_number: 1
      },
      progress: formattedProgress,
      attempts,
      timeline,
      evidence,
      documentAddressMatch
    });
  } catch (err) {
    console.error('Case review error:', err);
    res.status(500).json({ error: 'Failed to load case review.' });
  }
});

// POST /api/review/:caseRefOrEmpId/decision - Submit BGV Decision
router.post('/:caseRefOrEmpId/decision', authenticateAdmin, requireRoles('Super Admin', 'HR/Admin', 'BGV Reviewer'), async (req, res) => {
  try {
    const { caseRefOrEmpId } = req.params;
    const { decision, remarks, failureReason } = req.body;

    if (!decision || !['VERIFIED', 'VERIFICATION FAILED', 'REVERIFICATION REQUIRED', 'MORE INFORMATION REQUIRED'].includes(decision)) {
      return res.status(400).json({ error: 'Please select a valid BGV decision.' });
    }

    if (decision === 'VERIFICATION FAILED' && !failureReason) {
      return res.status(400).json({ error: 'Failure Reason is mandatory when marking verification failed.' });
    }

    if (decision === 'REVERIFICATION REQUIRED' && !remarks) {
      return res.status(400).json({ error: 'Please provide instructions / remarks for reverification.' });
    }

    // Identify employee
    const employee = await query.get(
      `SELECT e.*, vc.id as case_id, vc.case_reference, vc.current_attempt_number
       FROM employees e
       LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
       WHERE e.employee_id = ? OR vc.case_reference = ?`,
      [caseRefOrEmpId, caseRefOrEmpId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee or case not found.' });
    }

    const empId = employee.employee_id;
    const caseRef = employee.case_reference || `AV-${Date.now()}`;
    const attemptNo = employee.current_attempt_number || 1;

    // Map decision to employee master status
    let mappedStatus = 'Pending BGV Review';
    if (decision === 'VERIFIED') mappedStatus = 'Verified';
    else if (decision === 'VERIFICATION FAILED') mappedStatus = 'Verification Failed';
    else if (decision === 'REVERIFICATION REQUIRED') mappedStatus = 'Reverification Required';
    else if (decision === 'MORE INFORMATION REQUIRED') mappedStatus = 'More Information Required';

    // 1. Update verification_cases
    await query.run(
      `UPDATE verification_cases SET
        status = ?,
        final_decision = ?,
        final_remarks = ?,
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [mappedStatus, decision, remarks || '', req.user.full_name, empId]
    );

    // 2. Update current verification_attempts
    await query.run(
      `UPDATE verification_attempts SET
        status = ?,
        decision = ?,
        reviewer_id = ?,
        reviewer_remarks = ?,
        failure_reason = ?,
        reviewed_at = CURRENT_TIMESTAMP
       WHERE employee_id = ? AND attempt_number = ?`,
      [mappedStatus, decision, req.user.id, remarks || '', failureReason || null, empId, attemptNo]
    );

    // 3. Update Employee Master status (Original HR data remains untouched!)
    await query.run(
      `UPDATE employees SET
        verification_status = ?,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = ?`,
      [mappedStatus, req.user.full_name, empId]
    );

    // 4. If Reverification Required: prepare new attempt clean fields while preserving previous attempt records
    if (decision === 'REVERIFICATION REQUIRED') {
      await query.run(
        `UPDATE verification_cases SET
          current_attempt_number = current_attempt_number + 1
         WHERE employee_id = ?`,
        [empId]
      );

      // Reset mutable progress steps so employee must re-capture all evidence photos from scratch cleanly
      await query.run(
        `UPDATE verification_progress SET
          attempt_number = attempt_number + 1,
          current_step = 1,
          selfie_captured = 0,
          selfie_path = NULL,
          selfie_latitude = NULL,
          selfie_longitude = NULL,
          selfie_accuracy = NULL,
          selfie_captured_at = NULL,
          house_photo_captured = 0,
          house_photo_path = NULL,
          house_photo_latitude = NULL,
          house_photo_longitude = NULL,
          house_photo_accuracy = NULL,
          house_photo_captured_at = NULL,
          door_photo_captured = 0,
          door_photo_path = NULL,
          door_photo_latitude = NULL,
          door_photo_longitude = NULL,
          door_photo_accuracy = NULL,
          door_photo_captured_at = NULL,
          street_photo_captured = 0,
          street_photo_path = NULL,
          street_photo_latitude = NULL,
          street_photo_longitude = NULL,
          street_photo_accuracy = NULL,
          street_photo_captured_at = NULL,
          landmark_photo_captured = 0,
          landmark_photo_path = NULL,
          landmark_photo_latitude = NULL,
          landmark_photo_longitude = NULL,
          landmark_photo_accuracy = NULL,
          landmark_photo_captured_at = NULL,
          address_proof_uploaded = 0,
          document_type = NULL,
          document_path = NULL,
          document_original_name = NULL,
          document_back_path = NULL,
          document_back_original_name = NULL,
          declaration_accepted = 0,
          declaration_timestamp = NULL
         WHERE employee_id = ?`,
        [empId]
      );
    }

    // 5. Add to Timeline
    await query.run(
      `INSERT INTO verification_timeline (employee_id, case_reference, attempt_number, action, actor_type, actor_name, details)
       VALUES (?, ?, ?, ?, 'Reviewer', ?, ?)`,
      [
        empId,
        caseRef,
        attemptNo,
        `Decision: ${decision}`,
        req.user.full_name,
        `BGV Decision marked as ${decision}. Remarks: ${remarks || 'None'}${failureReason ? ` (Reason: ${failureReason})` : ''}`
      ]
    );

    // 6. Audit Log
    await query.run(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, employee_id, case_reference, details)
       VALUES ('Reviewer', ?, ?, 'BGV Decision Made', ?, ?, ?)`,
      [req.user.id.toString(), req.user.full_name, empId, caseRef, `Decision: ${decision}, Status: ${mappedStatus}`]
    );

    // 7. Automatically generate verification report PDF and save to internal Download Area
    const fullCaseData = await query.get(
      `SELECT e.*, vc.case_reference, vc.final_decision, vc.final_remarks, vc.reviewed_by, vc.reviewed_at,
              vp.submitted_address, vp.address_is_same, vp.address_difference_reason,
              vp.residence_type, vp.staying_since_month, vp.staying_since_year,
              vp.latitude, vp.longitude, vp.gps_accuracy, vp.distance_from_hr_meters, vp.distance_category,
              vp.selfie_captured, vp.house_photo_captured, vp.address_proof_uploaded, vp.document_type,
              vp.document_original_name, vp.declaration_accepted, vp.declaration_timestamp
       FROM employees e
       LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
       LEFT JOIN verification_progress vp ON e.employee_id = vp.employee_id
       WHERE e.employee_id = ?`,
      [empId]
    );

    let reportFile = null;
    try {
      reportFile = await generateVerificationReportPDF(
        { ...fullCaseData, failure_reason: failureReason },
        req.user.full_name
      );
    } catch (pdfErr) {
      console.error('PDF Generation warning:', pdfErr);
    }

    res.json({
      success: true,
      message: `Case decision successfully recorded as ${decision}.`,
      status: mappedStatus,
      reportFile: reportFile ? reportFile.fileName : null
    });
  } catch (err) {
    console.error('Submit decision error:', err);
    res.status(500).json({ error: 'Failed to record BGV decision.' });
  }
});

// POST /api/review/:caseRefOrEmpId/generate-report - Explicitly generate PDF report into Download Area
router.post('/:caseRefOrEmpId/generate-report', authenticateAdmin, async (req, res) => {
  try {
    const { caseRefOrEmpId } = req.params;

    const fullCaseData = await query.get(
      `SELECT e.*, vc.case_reference, vc.final_decision, vc.final_remarks, vc.reviewed_by, vc.reviewed_at,
              vp.submitted_address, vp.address_is_same, vp.address_difference_reason,
              vp.residence_type, vp.staying_since_month, vp.staying_since_year,
              vp.latitude, vp.longitude, vp.gps_accuracy, vp.distance_from_hr_meters, vp.distance_category,
              vp.selfie_captured, vp.house_photo_captured, vp.address_proof_uploaded, vp.document_type,
              vp.document_original_name, vp.declaration_accepted, vp.declaration_timestamp
       FROM employees e
       LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
       LEFT JOIN verification_progress vp ON e.employee_id = vp.employee_id
       WHERE e.employee_id = ? OR vc.case_reference = ?`,
      [caseRefOrEmpId, caseRefOrEmpId]
    );

    if (!fullCaseData) {
      return res.status(404).json({ error: 'Case data not found for report generation.' });
    }

    const report = await generateVerificationReportPDF(fullCaseData, req.user.full_name);

    res.json({
      success: true,
      message: 'Report generated successfully and saved in Download Area.',
      report
    });
  } catch (err) {
    console.error('Generate report error:', err);
    res.status(500).json({ error: 'Failed to generate verification report.' });
  }
});

// POST /api/review/:caseRefOrEmpId/geocode-hr - Geocode HR address and recalculate distance
router.post('/:caseRefOrEmpId/geocode-hr', authenticateAdmin, async (req, res) => {
  try {
    const { caseRefOrEmpId } = req.params;

    const employee = await query.get(
      `SELECT e.*, vc.case_reference
       FROM employees e
       LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
       WHERE e.employee_id = ? OR vc.case_reference = ?`,
      [caseRefOrEmpId, caseRefOrEmpId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee record not found.' });
    }

    const empId = employee.employee_id;
    const caseRef = employee.case_reference || `AV-${empId}`;

    // Execute 100% automatic geocoding worker
    const geoResult = await processSingleEmployee(empId);

    if (!geoResult) {
      return res.status(500).json({ error: 'Automatic geocoding failed to process.' });
    }

    const updatedEmp = await query.get('SELECT * FROM employees WHERE employee_id = ?', [empId]);
    const progress = await query.get('SELECT * FROM verification_progress WHERE employee_id = ?', [empId]);

    res.json({
      success: geoResult.success,
      status: updatedEmp.hr_geocoding_status,
      confidence: updatedEmp.hr_geocoding_confidence,
      referenceType: updatedEmp.hr_reference_type,
      referenceQuality: updatedEmp.hr_reference_quality,
      matchScore: updatedEmp.hr_match_score,
      houseMatch: updatedEmp.hr_house_match,
      streetMatch: updatedEmp.hr_street_match,
      areaMatch: updatedEmp.hr_area_match,
      landmarkMatch: updatedEmp.hr_landmark_match,
      pincodeMatch: updatedEmp.hr_pincode_match,
      cityMatch: updatedEmp.hr_city_match,
      stateMatch: updatedEmp.hr_geocode_state_match,
      hrLatitude: updatedEmp.hr_latitude,
      hrLongitude: updatedEmp.hr_longitude,
      provider: updatedEmp.hr_geocoding_provider,
      geocodedAddress: updatedEmp.hr_geocoded_address,
      normalizedAddress: updatedEmp.hr_normalized_address,
      addressSent: updatedEmp.hr_address_sent,
      geocodedAt: updatedEmp.hr_geocoded_at,
      distanceMeters: progress?.distance_from_hr_meters,
      distanceFormatted: formatDistance(progress?.distance_from_hr_meters),
      distanceCategory: progress?.distance_category,
      message: `HR Address Automatically Geocoded (${updatedEmp.hr_geocoding_status}: Score ${updatedEmp.hr_match_score}%)`
    });
  } catch (err) {
    console.error('Geocode HR error:', err);
    res.status(500).json({ error: 'Failed to geocode HR address.' });
  }
});

// POST /api/review/:caseRefOrEmpId/update-hr-location - Deprecated: Manual location disabled per system requirements
router.post('/:caseRefOrEmpId/update-hr-location', authenticateAdmin, async (req, res) => {
  return res.status(403).json({
    error: 'Manual HR location entry is disabled. The system uses 100% automatic HR address geolocation.'
  });
});

// POST /api/review/:caseRefOrEmpId/match-document-address - On-demand Address Proof OCR & Matching
router.post('/:caseRefOrEmpId/match-document-address', authenticateAdmin, async (req, res) => {
  try {
    const { caseRefOrEmpId } = req.params;
    let employee = await query.get(
      `SELECT e.* FROM employees e
       WHERE e.employee_id = ? OR e.employee_id IN (SELECT employee_id FROM verification_cases WHERE case_reference = ?)`,
      [caseRefOrEmpId, caseRefOrEmpId]
    );
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const progress = await query.get(
      'SELECT * FROM verification_progress WHERE employee_id = ?',
      [employee.employee_id]
    );

    const result = await performDocumentAddressMatch(employee, progress);
    res.json(result);
  } catch (err) {
    console.error('Match document address error:', err);
    res.status(500).json({ error: 'Failed to process document address match.' });
  }
});

module.exports = router;
