/**
 * Automatic Background Geocoding Queue Worker for Collman Services Address Verification:
 * - Asynchronous background processing on Employee Upload (Single & Bulk)
 * - Rate-limited execution to comply with geocoding provider standards
 * - Automatic result scoring, coordinate saving & distance recalculation
 * - Real-time statistics monitoring (Total, Processed, Pending, Failed)
 */

const { query } = require('../db/database');
const { geocodeAddress, calculateDistanceMeters, classifyDistance, formatDistance } = require('./geoUtils');

let isProcessing = false;
const queue = [];

/**
 * Enqueue employee ID(s) for automatic background geocoding.
 */
async function enqueueEmployees(employeeIds) {
  const ids = Array.isArray(employeeIds) ? employeeIds : [employeeIds];
  for (const id of ids) {
    const sId = String(id).trim();
    if (sId && !queue.includes(sId)) {
      queue.push(sId);
      try {
        await query.run(
          `UPDATE employees SET hr_geocoding_queue_status = 'QUEUED', updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?`,
          [sId]
        );
      } catch (err) {
        console.warn(`[GEOCODING QUEUE] Error marking employee ${sId} as QUEUED:`, err.message);
      }
    }
  }

  console.log(`[GEOCODING QUEUE] Enqueued ${ids.length} employees. Total queue length: ${queue.length}`);

  // Trigger processor loop if not already running
  if (!isProcessing) {
    processNextInQueue().catch(err => console.error('[GEOCODING QUEUE] Worker loop error:', err));
  }
}

/**
 * Background worker loop processing queue items with rate limiting.
 */
async function processNextInQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const empId = queue.shift();

    try {
      await processSingleEmployee(empId);
    } catch (err) {
      console.error(`[GEOCODING QUEUE] Failed processing employee ${empId}:`, err);
    }

    // Rate-limit pause (1000ms) to ensure smooth Nominatim / external API throughput
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  isProcessing = false;
}

/**
 * Process a single employee's address through the 100% automatic geocoding engine.
 */
async function processSingleEmployee(empId) {
  const employee = await query.get(
    `SELECT e.*, vc.case_reference
     FROM employees e
     LEFT JOIN verification_cases vc ON e.employee_id = vc.employee_id
     WHERE e.employee_id = ?`,
    [empId]
  );

  if (!employee) {
    console.warn(`[GEOCODING QUEUE] Employee ${empId} not found in database.`);
    return null;
  }

  const caseRef = employee.case_reference || `AV-${empId}`;

  // Update status to PROCESSING
  await query.run(
    `UPDATE employees SET hr_geocoding_queue_status = 'PROCESSING', hr_geocoding_attempts = hr_geocoding_attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?`,
    [empId]
  );

  // Provider configuration
  const providerSetting = await query.get("SELECT value FROM app_settings WHERE key='geocoding_provider'");
  const googleKeySetting = await query.get("SELECT value FROM app_settings WHERE key='google_maps_api_key'");
  const provider = providerSetting?.value || process.env.GEOCODING_PROVIDER || 'OpenStreetMap / Nominatim';
  const googleApiKey = googleKeySetting?.value || process.env.GOOGLE_MAPS_API_KEY;

  // Execute 100% automatic geocoding
  const geoResult = await geocodeAddress(employee, {
    provider,
    googleApiKey
  });

  const hrLat = geoResult.latitude || null;
  const hrLng = geoResult.longitude || null;
  const isUsable = geoResult.success && geoResult.referenceQuality !== 'INSUFFICIENT ADDRESS PRECISION';

  // Save all score and reference quality attributes to employees table
  await query.run(
    `UPDATE employees SET
      hr_latitude = ?,
      hr_longitude = ?,
      hr_original_lat = COALESCE(hr_original_lat, ?),
      hr_original_lng = COALESCE(hr_original_lng, ?),
      hr_geocoding_provider = ?,
      hr_geocoding_status = ?,
      hr_geocoding_confidence = ?,
      hr_geocoding_queue_status = ?,
      hr_geocoded_at = CURRENT_TIMESTAMP,
      hr_geocoding_date = CURRENT_TIMESTAMP,
      hr_geocoded_address = ?,
      hr_normalized_address = ?,
      hr_address_sent = ?,
      hr_reference_type = ?,
      hr_reference_quality = ?,
      hr_match_score = ?,
      hr_house_match = ?,
      hr_street_match = ?,
      hr_area_match = ?,
      hr_landmark_match = ?,
      hr_pincode_match = ?,
      hr_city_match = ?,
      hr_geocode_state_match = ?,
      -- Alias columns for backward compatibility
      hr_geocode_latitude = ?,
      hr_geocode_longitude = ?,
      hr_geocode_provider = ?,
      hr_geocode_status = ?,
      hr_geocode_returned_address = ?,
      hr_geocode_confidence = ?,
      hr_geocode_pincode_match = ?,
      hr_geocode_area_match = ?,
      hr_geocode_city_match = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE employee_id = ?`,
    [
      hrLat,
      hrLng,
      hrLat,
      hrLng,
      geoResult.provider,
      geoResult.status,
      geoResult.confidence,
      geoResult.status,
      geoResult.displayName || '',
      geoResult.normalizedAddress || '',
      geoResult.addressSent || '',
      geoResult.referenceType || 'LOCALITY',
      geoResult.referenceQuality || 'INSUFFICIENT ADDRESS PRECISION',
      geoResult.matchScore || 0,
      geoResult.houseMatch || 'N/A',
      geoResult.streetMatch || 'NO',
      geoResult.areaMatch || 'NO',
      geoResult.landmarkMatch || 'N/A',
      geoResult.pincodeMatch || 'UNKNOWN',
      geoResult.cityMatch || 'NO',
      geoResult.stateMatch || 'NO',
      hrLat,
      hrLng,
      geoResult.provider,
      geoResult.status,
      geoResult.displayName || '',
      geoResult.confidence,
      geoResult.pincodeMatch || 'UNKNOWN',
      geoResult.areaMatch || 'NO',
      geoResult.cityMatch || 'NO',
      empId
    ]
  );

  // If employee has already captured live GPS, recalculate distance and proximity
  const progress = await query.get('SELECT * FROM verification_progress WHERE employee_id = ?', [empId]);

  if (progress && progress.latitude && progress.longitude) {
    if (isUsable && hrLat !== null && hrLng !== null) {
      const distanceMeters = calculateDistanceMeters(hrLat, hrLng, progress.latitude, progress.longitude);
      const classification = classifyDistance(
        distanceMeters,
        geoResult.referenceType,
        progress.gps_accuracy,
        geoResult.referenceQuality
      );

      await query.run(
        `UPDATE verification_progress SET
          distance_from_hr_meters = ?,
          distance_category = ?
         WHERE employee_id = ?`,
        [distanceMeters, classification.category, empId]
      );

      console.log(`[GEOCODING QUEUE] Recalculated distance for ${empId}: ${formatDistance(distanceMeters)} (${classification.category})`);
    } else {
      await query.run(
        `UPDATE verification_progress SET
          distance_from_hr_meters = NULL,
          distance_category = 'INSUFFICIENT LOCATION ACCURACY'
         WHERE employee_id = ?`,
        [empId]
      );
    }
  }

  // Insert timeline log
  await query.run(
    `INSERT INTO verification_timeline (employee_id, case_reference, attempt_number, action, actor_type, actor_name, details)
     VALUES (?, ?, ?, 'Automatic HR Address Geocoded', 'System', 'Automatic Geocoding Engine', ?)`,
    [
      empId,
      caseRef,
      progress ? progress.attempt_number : 1,
      `Automatically geocoded HR address (${geoResult.status}): Score ${geoResult.matchScore}% (${geoResult.referenceQuality}), Type: ${geoResult.referenceType}, Provider: ${geoResult.provider}`
    ]
  );

  return geoResult;
}

/**
 * Get current geocoding queue metrics for monitoring and bulk upload feedback.
 */
async function getQueueStats() {
  const stats = await query.get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN hr_geocoding_queue_status IN ('GEOCODED', 'APPROXIMATE') THEN 1 ELSE 0 END) as processed,
      SUM(CASE WHEN hr_geocoding_queue_status IN ('QUEUED', 'PROCESSING') OR hr_geocoding_queue_status IS NULL THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN hr_geocoding_queue_status = 'FAILED' THEN 1 ELSE 0 END) as failed
    FROM employees
  `);

  return {
    total: stats?.total || 0,
    processed: stats?.processed || 0,
    pending: stats?.pending || 0,
    failed: stats?.failed || 0,
    activeInQueue: queue.length,
    isProcessing
  };
}

module.exports = {
  enqueueEmployees,
  processSingleEmployee,
  getQueueStats
};
