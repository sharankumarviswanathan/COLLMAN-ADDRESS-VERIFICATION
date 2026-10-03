/**
 * 100% Automatic Geographic Engine for Collman Services Address Verification:
 * - Automatic Address Normalization & Component Dissection
 * - 5-Tier Progressive Multi-Search Attempts
 * - Multi-Provider Execution & Consensus (Google Maps / OpenStreetMap Nominatim)
 * - 100-Point Automatic Address Match Scoring:
 *     House Number (25) + Street (20) + Area (20) + Pincode (15) + City (10) + State (5) + Landmark (5)
 * - Reference Classification: BUILDING / STREET / AREA / LOCALITY
 * - Confidence Grading: VERY HIGH (90-100) / HIGH (75-89) / MEDIUM (60-74) / LOW (<60)
 * - Reference Quality: PRECISE vs APPROXIMATE vs INSUFFICIENT ADDRESS PRECISION
 * - Dynamic Distance Tolerances & Smart Proximity Auditing
 */

/**
 * Haversine formula to calculate great-circle distance between two points in meters.
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null ||
      lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return null;
  }

  const nLat1 = parseFloat(lat1);
  const nLon1 = parseFloat(lon1);
  const nLat2 = parseFloat(lat2);
  const nLon2 = parseFloat(lon2);

  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) {
    return null;
  }

  const R = 6371e3; // Earth radius in metres
  const phi1 = (nLat1 * Math.PI) / 180;
  const phi2 = (nLat2 * Math.PI) / 180;
  const deltaPhi = ((nLat2 - nLat1) * Math.PI) / 180;
  const deltaLambda = ((nLon2 - nLon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Format distance user-friendly:
/**
 * Format distance strictly in meters:
 * - Always shows exact meters: e.g. '85 m', '207 m'
 */
function formatDistance(distanceMeters) {
  if (distanceMeters === null || distanceMeters === undefined || isNaN(parseFloat(distanceMeters))) {
    return 'N/A';
  }
  return `${Math.round(parseFloat(distanceMeters))} m`;
}

/**
 * Fixed 100-meter Address Verification Radius Rule:
 * - Distance <= 100 meters: INSIDE RADIUS / PASS
 * - Distance > 100 meters: OUTSIDE RADIUS / REVIEW REQUIRED
 */
const RADIUS_LIMIT_METERS = 100;

function getDynamicToleranceMeters() {
  return RADIUS_LIMIT_METERS;
}

function classifyDistance(
  distanceMeters,
  referenceType = 'STREET',
  gpsAccuracy = null,
  referenceQuality = 'PRECISE'
) {
  if (distanceMeters === null || distanceMeters === undefined || isNaN(parseFloat(distanceMeters))) {
    return {
      category: 'NO GPS REFERENCE',
      badgeClass: 'badge-secondary',
      label: 'No GPS Reference',
      isPass: false
    };
  }

  const dist = parseFloat(distanceMeters);
  const isPrecise = (referenceQuality === 'PRECISE');

  // Requirement 9: Apply the 100-meter PASS rule ONLY when the HR reference is sufficiently precise.
  if (!isPrecise) {
    return {
      category: 'HR LOCATION APPROXIMATE - REVIEW REQUIRED',
      badgeClass: 'badge-warning',
      label: `${Math.round(dist)} m (HR LOCATION APPROXIMATE - REVIEW REQUIRED)`,
      isPass: false
    };
  }

  if (dist <= RADIUS_LIMIT_METERS) {
    return {
      category: 'INSIDE RADIUS / PASS',
      badgeClass: 'badge-success',
      label: `${Math.round(dist)} m (INSIDE RADIUS / PASS)`,
      isPass: true
    };
  } else {
    return {
      category: 'OUTSIDE RADIUS / REVIEW REQUIRED',
      badgeClass: 'badge-warning',
      label: `${Math.round(dist)} m (OUTSIDE RADIUS / REVIEW REQUIRED)`,
      isPass: false
    };
  }
}

/**
 * Levenshtein distance for fuzzy area/locality spelling comparisons.
 */
function levenshteinDistance(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;
  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Fuzzy check if target token appears in source text.
 */
function fuzzyContains(sourceText, targetToken) {
  if (!sourceText || !targetToken) return false;
  const s = sourceText.toLowerCase();
  const t = targetToken.toLowerCase().trim();
  if (s.includes(t)) return true;

  // Word-by-word fuzzy comparison (Levenshtein <= 2 or common prefix)
  const words = s.split(/[\s,./-]+/).filter(w => w.length >= 4);
  for (const w of words) {
    if (levenshteinDistance(w, t) <= 2) return true;
    if (t.length >= 6 && w.length >= 6 && (w.startsWith(t.slice(0, 5)) || t.startsWith(w.slice(0, 5)))) return true;
  }
  return false;
}

/**
 * Extract house/door/flat number from address string.
 */
function extractHouseNumber(str) {
  if (!str) return '';
  const match = str.match(/\b(?:no\.?|door\s*no\.?|flat\s*no\.?|d\.?no\.?|plot\s*no\.?|house\s*no\.?)?\s*([0-9]+[A-Za-z]?[\/-]?[0-9]*[A-Za-z]?)\b/i);
  return match ? match[1].toUpperCase() : '';
}

/**
 * Extract 6-digit Indian pincode from an address or object.
 */
function extractPincode(addrObj) {
  if (typeof addrObj === 'object') {
    const p = addrObj.hr_pincode || addrObj.pincode;
    if (p && /^[1-9][0-9]{5}$/.test(String(p).trim())) {
      return String(p).trim();
    }
  }
  const text = typeof addrObj === 'string' ? addrObj : (addrObj.hr_current_address || addrObj.address || buildFullAddressString(addrObj));
  const match = text.match(/\b([1-9][0-9]{5})\b/);
  return match ? match[1] : '';
}

/**
 * Clean door numbers, plot numbers, flat numbers to improve geocoding matching.
 */
function cleanDoorNumber(str) {
  if (!str) return '';
  return str
    .replace(/^(no\.?|door\s*no\.?|flat\s*no\.?|plot\s*no\.?|d\.?no\.?|house\s*no\.?)?\s*[\d/A-Za-z-]+\s*[,\s]+/i, '')
    .replace(/[#&]/g, ' ')
    .trim();
}

/**
 * Normalize an address string:
 * - Removes redundant spaces, line breaks, repeated commas
 * - Fixes formatting
 */
function normalizeAddress(str) {
  if (!str) return '';
  return str
    .replace(/[\r\n\t]+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();
}

/**
 * Build complete address automatically combining ALL available HR employee master fields.
 * Includes: Address Line 1, Address Line 2, Area, Landmark, City, District, State, Pincode, Location, Country.
 */
function buildFullAddressString(addrObj) {
  if (!addrObj) return '';
  if (typeof addrObj === 'string') {
    let clean = normalizeAddress(addrObj);
    if (!clean.toLowerCase().includes('india')) clean += ', India';
    return clean;
  }

  const address = addrObj.hr_current_address || addrObj.address || '';
  const addressLine1 = addrObj.hr_address_line1 || addrObj.addressLine1 || '';
  const addressLine2 = addrObj.hr_address_line2 || addrObj.addressLine2 || '';
  const area = addrObj.hr_area || addrObj.area || '';
  const landmark = addrObj.hr_landmark || addrObj.landmark || '';
  const city = addrObj.hr_city || addrObj.city || '';
  const district = addrObj.hr_district || addrObj.district || '';
  const state = addrObj.hr_state || addrObj.state || '';
  const pincode = addrObj.hr_pincode || addrObj.pincode || '';
  const location = addrObj.location || '';
  const country = addrObj.country || 'India';

  const rawAddress = address || [addressLine1, addressLine2].filter(Boolean).join(', ');
  let cleanRaw = normalizeAddress(rawAddress);

  const parts = [];
  if (cleanRaw) parts.push(cleanRaw);

  const rawLower = cleanRaw.toLowerCase();

  // Append Area if not already present
  if (area && !rawLower.includes(area.toLowerCase().trim())) {
    parts.push(area.trim());
  }

  // Append Landmark if not already present
  if (landmark && !rawLower.includes(landmark.toLowerCase().trim())) {
    parts.push(landmark.trim());
  }

  // Append Location if distinct
  if (location && !rawLower.includes(location.toLowerCase().trim()) && (!city || !city.toLowerCase().includes(location.toLowerCase().trim()))) {
    parts.push(location.trim());
  }

  // Append City if not already present
  if (city && !rawLower.includes(city.toLowerCase().trim())) {
    parts.push(city.trim());
  }

  // Append District if not already present
  if (district && !rawLower.includes(district.toLowerCase().trim()) && (!city || !city.toLowerCase().includes(district.toLowerCase().trim()))) {
    parts.push(district.trim());
  }

  // Append State if not already present
  if (state && !rawLower.includes(state.toLowerCase().trim())) {
    parts.push(state.trim());
  }

  // Append 6-digit Pincode if not already present
  const pin = pincode || (cleanRaw.match(/\b([1-9][0-9]{5})\b/) ? cleanRaw.match(/\b([1-9][0-9]{5})\b/)[1] : '');
  if (pin && !cleanRaw.includes(pin)) {
    parts.push(pin);
  }

  // Always append country
  if (!rawLower.includes('india')) {
    parts.push(country || 'India');
  }

  const combined = parts.filter(Boolean).join(', ');
  return normalizeAddress(combined);
}

/**
 * 100-Point Automatic Address Match Scoring:
 * - House Number Match = 25 points
 * - Street Match = 20 points
 * - Area/Locality Match = 20 points (with fuzzy comparison)
 * - Pincode Match = 15 points (mismatch = -25 penalty)
 * - City Match = 10 points
 * - State Match = 5 points
 * - Landmark Match = 5 points
 * Total = 100 points
 */
function evaluateCandidateResult(item, hrAddrObj, provider = 'OpenStreetMap / Nominatim') {
  const hrRawText = (
    (hrAddrObj.address || hrAddrObj.hr_current_address || '') + ' ' +
    (hrAddrObj.addressLine1 || hrAddrObj.hr_address_line1 || '') + ' ' +
    (hrAddrObj.addressLine2 || hrAddrObj.hr_address_line2 || '')
  );

  const resText = (item.display_name || item.formatted_address || '').toLowerCase();
  const addressDetails = item.address || {};

  let matchScore = 0;

  // 1. House Number Match (25 pts)
  const hrHouseNo = extractHouseNumber(hrRawText);
  let houseMatch = 'N/A';
  if (hrHouseNo) {
    const resHouse = (addressDetails.house_number || '').toUpperCase();
    if (resHouse === hrHouseNo || resText.includes(hrHouseNo.toLowerCase())) {
      houseMatch = 'YES';
      matchScore += 25;
    } else {
      houseMatch = 'NO';
    }
  }

  // 2. Street Match (20 pts)
  let streetMatch = 'NO';
  const streetTokens = hrRawText
    .split(/(?<=\bstreet\b|\broad\b|\bsalai\b|\bnagar\b)\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  for (const st of streetTokens) {
    const cleanSt = cleanDoorNumber(st);
    if (cleanSt && (fuzzyContains(resText, cleanSt) || (addressDetails.road && fuzzyContains(addressDetails.road, cleanSt)))) {
      streetMatch = 'YES';
      matchScore += 20;
      break;
    }
  }
  if (streetMatch === 'NO' && addressDetails.road && fuzzyContains(hrRawText, addressDetails.road)) {
    streetMatch = 'YES';
    matchScore += 20;
  }

  // 3. Area / Locality Match (20 pts with fuzzy support)
  let areaMatch = 'NO';
  const candidateAreas = [];
  if (hrAddrObj.area) candidateAreas.push(hrAddrObj.area);
  if (hrAddrObj.hr_area) candidateAreas.push(hrAddrObj.hr_area);
  if (hrAddrObj.location) candidateAreas.push(hrAddrObj.location);

  // Extract locality words from address text
  const rawWords = hrRawText.split(/[\s,./-]+/).filter(w => w.length > 4 && !/^\d+$/.test(w));
  for (const w of rawWords) {
    if (!candidateAreas.includes(w)) candidateAreas.push(w);
  }

  let matchedAreaCount = 0;
  for (const a of candidateAreas) {
    if (fuzzyContains(resText, a) || (addressDetails.suburb && fuzzyContains(addressDetails.suburb, a)) || (addressDetails.neighbourhood && fuzzyContains(addressDetails.neighbourhood, a))) {
      matchedAreaCount++;
    }
  }

  if (matchedAreaCount >= 2) {
    areaMatch = 'YES';
    matchScore += 20;
  } else if (matchedAreaCount === 1) {
    areaMatch = 'PARTIAL';
    matchScore += 12;
  }

  // 4. Pincode Match (15 pts, mismatch = -25 penalty)
  const hrPincode = extractPincode(hrAddrObj);
  const resPincode = addressDetails.postcode || (resText.match(/\b([1-9][0-9]{5})\b/) ? resText.match(/\b([1-9][0-9]{5})\b/)[1] : '');
  let pincodeMatch = 'UNKNOWN';
  if (hrPincode && resPincode) {
    if (hrPincode === resPincode) {
      pincodeMatch = 'YES';
      matchScore += 15;
    } else {
      pincodeMatch = 'NO';
      matchScore -= 25; // Severe penalty for postal code mismatch
    }
  } else if (hrPincode && !resPincode) {
    if (resText.includes(hrPincode)) {
      pincodeMatch = 'YES';
      matchScore += 15;
    } else {
      pincodeMatch = 'UNKNOWN';
    }
  }

  // 5. City Match (10 pts)
  const hrCity = (hrAddrObj.city || hrAddrObj.hr_city || 'Chennai').toLowerCase().trim();
  const resCity = (addressDetails.city || addressDetails.town || addressDetails.city_district || '').toLowerCase();
  let cityMatch = (resCity && resCity.includes(hrCity)) || resText.includes(hrCity) ? 'YES' : 'NO';
  if (cityMatch === 'YES') {
    matchScore += 10;
  }

  // 6. State Match (5 pts)
  const hrState = (hrAddrObj.state || hrAddrObj.hr_state || 'Tamil Nadu').toLowerCase().trim();
  const resState = (addressDetails.state || '').toLowerCase();
  let stateMatch = (resState && resState.includes(hrState)) || resText.includes(hrState) ? 'YES' : 'NO';
  if (stateMatch === 'YES') {
    matchScore += 5;
  }

  // 7. Landmark Match (5 pts)
  let landmarkMatch = 'N/A';
  const hrLandmark = hrAddrObj.landmark || hrAddrObj.hr_landmark;
  if (hrLandmark) {
    if (fuzzyContains(resText, hrLandmark)) {
      landmarkMatch = 'YES';
      matchScore += 5;
    } else {
      landmarkMatch = 'NO';
    }
  }

  // Ensure score stays in [0, 100]
  matchScore = Math.max(0, Math.min(100, matchScore));

  // Determine Reference Type
  let referenceType = 'LOCALITY';
  const itemType = (item.type || '').toLowerCase();
  const itemClass = (item.class || '').toLowerCase();

  if (houseMatch === 'YES' || itemType === 'house' || itemType === 'building' || itemClass === 'building' || itemType === 'premise') {
    referenceType = 'BUILDING';
  } else if (streetMatch === 'YES' || itemType === 'secondary' || itemType === 'tertiary' || itemType === 'residential' || itemType === 'road' || itemType === 'street') {
    referenceType = 'STREET';
  } else if (areaMatch === 'YES' || itemType === 'suburb' || itemType === 'neighbourhood') {
    referenceType = 'AREA';
  } else {
    referenceType = 'LOCALITY';
  }

  // Check Broad Administrative Result (Reject city/corporation center as employee residence)
  const broadTypes = new Set(['administrative', 'city', 'state', 'country', 'state_district', 'county', 'region', 'municipality']);
  const isBroadAdmin = broadTypes.has(itemType) || itemClass === 'boundary';
  const isCityCorporation = resText.includes('chennai corporation') && !addressDetails.suburb && !addressDetails.neighbourhood && !addressDetails.road && pincodeMatch !== 'YES';

  if (isBroadAdmin || isCityCorporation) {
    matchScore = Math.min(matchScore, 40); // Cap broad administrative boundaries to < 60
    referenceType = 'LOCALITY';
  }

  // Confidence Grading based on 100-point scale:
  // 90–100: VERY HIGH CONFIDENCE
  // 75–89:  HIGH CONFIDENCE
  // 60–74:  MEDIUM CONFIDENCE
  // Below 60: LOW CONFIDENCE
  let confidence = 'LOW';
  let referenceQuality = 'INSUFFICIENT ADDRESS PRECISION';

  if (matchScore >= 90) {
    confidence = 'VERY HIGH';
    referenceQuality = 'PRECISE';
  } else if (matchScore >= 75) {
    confidence = 'HIGH';
    referenceQuality = 'PRECISE';
  } else if (matchScore >= 60) {
    confidence = 'MEDIUM';
    referenceQuality = 'APPROXIMATE';
  } else {
    confidence = 'LOW';
    referenceQuality = 'INSUFFICIENT ADDRESS PRECISION';
  }

  return {
    matchScore,
    confidence,
    referenceType,
    referenceQuality,
    houseMatch,
    streetMatch,
    areaMatch,
    landmarkMatch,
    pincodeMatch,
    cityMatch,
    stateMatch,
    isBroad: isBroadAdmin || isCityCorporation
  };
}

/**
 * Evaluate a single Google Maps Geocoding API candidate.
 * Requirement 4: Prefer results with location_type = ROOFTOP and type = street_address.
 * Requirement 5: If Google returns ROOFTOP, mark referenceQuality as PRECISE and use those exact coordinates.
 * Requirement 6: If Google returns RANGE_INTERPOLATED, GEOMETRIC_CENTER, or APPROXIMATE, mark HR location as APPROXIMATE.
 * Requirement 7: Never modify, shift, or manipulate HR coordinates.
 */
function evaluateGoogleCandidate(res, hrAddrObj) {
  const locType = res.geometry?.location_type || 'APPROXIMATE';
  const types = Array.isArray(res.types) ? res.types : [];
  const formattedAddress = res.formatted_address || '';
  const loc = res.geometry?.location || { lat: 0, lng: 0 };

  const hrRawText = (
    (hrAddrObj.address || hrAddrObj.hr_current_address || '') + ' ' +
    (hrAddrObj.addressLine1 || hrAddrObj.hr_address_line1 || '') + ' ' +
    (hrAddrObj.addressLine2 || hrAddrObj.hr_address_line2 || '')
  );
  const hrHouseNo = extractHouseNumber(hrRawText);
  const hrPincode = extractPincode(hrAddrObj);
  const hrCity = (hrAddrObj.city || hrAddrObj.hr_city || 'Chennai').toLowerCase().trim();
  const hrState = (hrAddrObj.state || hrAddrObj.hr_state || 'Tamil Nadu').toLowerCase().trim();

  let pincodeMatch = 'UNKNOWN';
  let cityMatch = 'NO';
  let stateMatch = 'NO';
  let houseMatch = hrHouseNo ? 'NO' : 'N/A';
  let streetMatch = 'NO';
  let areaMatch = 'NO';

  if (Array.isArray(res.address_components)) {
    for (const comp of res.address_components) {
      const cTypes = comp.types || [];
      const lName = (comp.long_name || '').toLowerCase();
      const sName = (comp.short_name || '').toLowerCase();

      if (cTypes.includes('postal_code')) {
        pincodeMatch = (comp.long_name === hrPincode || comp.short_name === hrPincode) ? 'YES' : 'NO';
      }
      if (cTypes.includes('locality') || cTypes.includes('administrative_area_level_2')) {
        if (lName.includes(hrCity) || hrCity.includes(lName)) cityMatch = 'YES';
      }
      if (cTypes.includes('administrative_area_level_1')) {
        if (lName.includes(hrState) || hrState.includes(lName) || sName === 'tn') stateMatch = 'YES';
      }
      if (cTypes.includes('street_number')) {
        houseMatch = 'YES';
      }
      if (cTypes.includes('route')) {
        streetMatch = 'YES';
      }
      if (cTypes.includes('sublocality') || cTypes.includes('sublocality_level_1') || cTypes.includes('neighborhood')) {
        areaMatch = 'YES';
      }
    }
  }

  const resLower = formattedAddress.toLowerCase();
  if (pincodeMatch === 'UNKNOWN' && hrPincode) {
    pincodeMatch = resLower.includes(hrPincode) ? 'YES' : 'UNKNOWN';
  }
  if (cityMatch === 'NO' && resLower.includes(hrCity)) cityMatch = 'YES';
  if (stateMatch === 'NO' && (resLower.includes(hrState) || resLower.includes('tamil nadu'))) stateMatch = 'YES';
  if (houseMatch === 'NO' && hrHouseNo && resLower.includes(hrHouseNo.toLowerCase())) houseMatch = 'YES';

  const isStreetAddress = types.includes('street_address');
  const isPremise = types.includes('premise') || types.includes('subpremise');

  let priorityRank = 99;
  let matchScore = 50;
  let referenceQuality = 'APPROXIMATE';
  let status = 'APPROXIMATE';
  let confidence = 'LOW';
  let referenceType = 'LOCALITY';

  // Strict compliance with Requirements 4, 5, and 6:
  if (locType === 'ROOFTOP') {
    referenceQuality = 'PRECISE';
    status = 'GEOCODED';
    referenceType = 'ROOFTOP';

    if (isStreetAddress) {
      priorityRank = 1; // Top preference: ROOFTOP + street_address
      confidence = 'VERY HIGH';
      matchScore = 100;
    } else if (isPremise) {
      priorityRank = 2; // Second preference: ROOFTOP + premise
      confidence = 'VERY HIGH';
      matchScore = 95;
    } else {
      priorityRank = 3; // Other ROOFTOP
      confidence = 'HIGH';
      matchScore = 90;
    }
  } else if (locType === 'RANGE_INTERPOLATED') {
    referenceQuality = 'APPROXIMATE';
    status = 'APPROXIMATE';
    referenceType = 'STREET';
    priorityRank = 4;
    confidence = 'MEDIUM';
    matchScore = 70;
  } else if (locType === 'GEOMETRIC_CENTER') {
    referenceQuality = 'APPROXIMATE';
    status = 'APPROXIMATE';
    referenceType = (types.includes('sublocality') || types.includes('neighborhood')) ? 'AREA' : (types.includes('route') ? 'STREET' : 'LOCALITY');
    priorityRank = 5;
    confidence = 'MEDIUM';
    matchScore = 65;
  } else {
    // APPROXIMATE
    referenceQuality = 'APPROXIMATE';
    status = 'APPROXIMATE';
    referenceType = (types.includes('sublocality') || types.includes('neighborhood')) ? 'AREA' : 'LOCALITY';
    priorityRank = 6;
    confidence = 'LOW';
    matchScore = 55;
  }

  // Penalize postal code conflict if explicitly different
  if (pincodeMatch === 'NO') {
    matchScore = Math.max(20, matchScore - 25);
  }

  return {
    priorityRank,
    matchScore,
    status,
    confidence,
    referenceType,
    referenceQuality,
    locationType: locType,
    types,
    houseMatch,
    streetMatch,
    areaMatch,
    landmarkMatch: 'N/A',
    pincodeMatch,
    cityMatch,
    stateMatch,
    // Requirement 7: Never modify, shift, or manipulate HR coordinates
    latitude: parseFloat(loc.lat.toFixed(6)),
    longitude: parseFloat(loc.lng.toFixed(6)),
    displayName: formattedAddress,
    provider: 'Google Maps'
  };
}

/**
 * 100% Automatic Geocoding Engine
 * 1. Primary Provider: Google Maps Geocoding API
 * 2. Fallback Provider: OpenStreetMap / Nominatim (Only when Google is unavailable or returns ZERO_RESULTS)
 * 3. Enforces full address: House Number + Street + Area + City + State + Pincode + India
 * 4. Prefers Google results with location_type = ROOFTOP and type = street_address
 * 5. Marks ROOFTOP as PRECISE (uses exact coordinates)
 * 6. Marks RANGE_INTERPOLATED, GEOMETRIC_CENTER, or APPROXIMATE as APPROXIMATE
 * 7. Never modifies, shifts, or manipulates HR coordinates
 */
async function geocodeAddress(addressInput, options = {}) {
  const fullAddressString = buildFullAddressString(addressInput);
  const normalizedAddress = normalizeAddress(fullAddressString);
  const hrPincode = extractPincode(addressInput);
  const empId = addressInput.employee_id || addressInput.employeeId || 'Unknown';

  console.log('=======================================================');
  console.log(`[AUTOMATIC GEOCODING] Employee ID: ${empId}`);
  console.log(`[AUTOMATIC GEOCODING] Complete HR Address: "${normalizedAddress}"`);
  console.log(`[AUTOMATIC GEOCODING] Primary Provider: Google Maps Geocoding API`);

  if (!normalizedAddress || normalizedAddress.trim().length === 0) {
    console.log(`[AUTOMATIC GEOCODING] Result: FAILED (Empty Address)`);
    console.log('=======================================================');
    return {
      success: false,
      status: 'FAILED',
      confidence: 'LOW',
      referenceQuality: 'INSUFFICIENT ADDRESS PRECISION',
      matchScore: 0,
      error: 'HR address is incomplete. Please update City, State or Pincode.'
    };
  }

  // =========================================================================
  // PROVIDER 1: Google Maps Geocoding API (PRIMARY PROVIDER)
  // Requirement 1: Use Google Maps Geocoding API as the PRIMARY provider.
  // Requirement 3: Always send the complete HR address including:
  //                House Number + Street + Area + City + State + Pincode + India.
  // =========================================================================
  const googleApiKey = options.googleApiKey || process.env.GOOGLE_MAPS_API_KEY;

  if (googleApiKey && String(googleApiKey).trim().length > 0) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(normalizedAddress)}&key=${encodeURIComponent(String(googleApiKey).trim())}&region=in`;
      console.log(`[AUTOMATIC GEOCODING] Calling PRIMARY provider: Google Maps Geocoding API...`);
      const gRes = await fetch(url);
      const gData = await gRes.json();

      if (gData.status === 'OK' && Array.isArray(gData.results) && gData.results.length > 0) {
        const googleCandidates = [];
        for (const res of gData.results) {
          if (res.geometry && res.geometry.location) {
            googleCandidates.push(evaluateGoogleCandidate(res, addressInput));
          }
        }

        if (googleCandidates.length > 0) {
          // Requirement 4: Prefer Google results with location_type = ROOFTOP and type = street_address
          googleCandidates.sort((a, b) => a.priorityRank - b.priorityRank || b.matchScore - a.matchScore);
          const best = googleCandidates[0];

          console.log(`[AUTOMATIC GEOCODING] Google Maps Best Match: "${best.displayName}"`);
          console.log(`[AUTOMATIC GEOCODING] Location Type: ${best.locationType} | Types: [${best.types.join(', ')}]`);
          console.log(`[AUTOMATIC GEOCODING] Quality: ${best.referenceQuality} | Status: ${best.status} | Confidence: ${best.confidence} | Score: ${best.matchScore}%`);
          console.log(`[AUTOMATIC GEOCODING] Reference Coordinates (Unmanipulated): Lat ${best.latitude}, Lon ${best.longitude}`);
          console.log('=======================================================');

          return {
            success: true,
            status: best.status,
            confidence: best.confidence,
            referenceType: best.referenceType,
            referenceQuality: best.referenceQuality,
            locationType: best.locationType,
            matchScore: best.matchScore,
            houseMatch: best.houseMatch,
            streetMatch: best.streetMatch,
            areaMatch: best.areaMatch,
            landmarkMatch: best.landmarkMatch,
            pincodeMatch: best.pincodeMatch,
            cityMatch: best.cityMatch,
            stateMatch: best.stateMatch,
            latitude: best.latitude,
            longitude: best.longitude,
            provider: 'Google Maps',
            displayName: best.displayName,
            normalizedAddress,
            addressSent: normalizedAddress,
            geocodedDate: new Date().toISOString()
          };
        }
      } else {
        console.warn(`[AUTOMATIC GEOCODING] Google Maps returned status "${gData.status}". Error:`, gData.error_message || 'Zero results');
      }
    } catch (err) {
      console.warn('[AUTOMATIC GEOCODING] Google Maps Geocoding API request error:', err.message);
    }
  } else {
    console.log('[AUTOMATIC GEOCODING] No Google Maps API Key configured. Proceeding to fallback provider...');
  }

  // =========================================================================
  // PROVIDER 2: OpenStreetMap / Nominatim (FALLBACK PROVIDER ONLY)
  // Requirement 2: Keep OpenStreetMap / Nominatim only as the FALLBACK provider.
  // =========================================================================
  console.log('[AUTOMATIC GEOCODING] Activating OpenStreetMap / Nominatim (FALLBACK Provider)...');
  const allCandidates = [];
  const rawAddr = (typeof addressInput === 'object' ? (addressInput.hr_current_address || addressInput.address) : addressInput) || '';
  const city = (addressInput.hr_city || addressInput.city || 'Chennai').trim();
  const state = (addressInput.hr_state || addressInput.state || 'Tamil Nadu').trim();

  const queriesToTry = [];

  // ATTEMPT 1: Complete House + Street + Area + City + State + Pincode + India
  queriesToTry.push({ label: 'Attempt 1 (Full Address)', query: normalizedAddress });

  // ATTEMPT 2: House + Street + Area + Pincode + India
  const cleanAddrNoCity = cleanDoorNumber(rawAddr);
  if (cleanAddrNoCity && hrPincode) {
    const q2 = normalizeAddress([cleanAddrNoCity, hrPincode, 'India'].filter(Boolean).join(', '));
    if (q2 !== normalizedAddress && !queriesToTry.some(q => q.query === q2)) {
      queriesToTry.push({ label: 'Attempt 2 (Street + Area + Pincode)', query: q2 });
    }
  }

  // ATTEMPT 3: Street + Area + City + Pincode + India
  const ignoreTokens = new Set(['street', 'road', 'salai', 'nagar', 'main', 'cross', 'lane', 'chennai', 'tamilnadu', 'tamil nadu', 'india']);
  const segments = rawAddr
    .split(/(?<=\bstreet\b|\broad\b|\bsalai\b|\bnagar\b)\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 5 && !ignoreTokens.has(s.toLowerCase()));

  for (const seg of segments) {
    const cleanSeg = cleanDoorNumber(seg);
    if (cleanSeg && cleanSeg.length > 5 && !ignoreTokens.has(cleanSeg.toLowerCase())) {
      const q3 = normalizeAddress([cleanSeg, city, state, hrPincode, 'India'].filter(Boolean).join(', '));
      if (!queriesToTry.some(q => q.query === q3)) {
        queriesToTry.push({ label: `Attempt 3 (Road Segment: ${cleanSeg})`, query: q3 });
      }
    }
  }

  // ATTEMPT 4: Area + Landmark + City + Pincode + India
  const areaVal = addressInput.hr_area || addressInput.area;
  const landmarkVal = addressInput.hr_landmark || addressInput.landmark;
  if (areaVal || landmarkVal) {
    const q4 = normalizeAddress([landmarkVal, areaVal, city, state, hrPincode, 'India'].filter(Boolean).join(', '));
    if (!queriesToTry.some(q => q.query === q4)) {
      queriesToTry.push({ label: 'Attempt 4 (Area + Landmark + City + Pincode)', query: q4 });
    }
  }

  // ATTEMPT 5: Area + City + Pincode + India
  if (areaVal) {
    const q5 = normalizeAddress([areaVal, city, state, hrPincode, 'India'].filter(Boolean).join(', '));
    if (!queriesToTry.some(q => q.query === q5)) {
      queriesToTry.push({ label: 'Attempt 5 (Area + City + Pincode)', query: q5 });
    }
  }

  // Add Pincode + City as final targeted boundary
  if (hrPincode) {
    const qPin = normalizeAddress([hrPincode, city, state, 'India'].filter(Boolean).join(', '));
    if (!queriesToTry.some(q => q.query === qPin)) {
      queriesToTry.push({ label: 'Targeted Pincode Centroid', query: qPin });
    }
  }

  const headers = { 'User-Agent': 'CollmanAddressVerification/1.0 (internal-bgv@collman.com)' };

  for (const { label, query } of queriesToTry) {
    try {
      const cleanQ = query.replace(/[#&]/g, ' ').replace(/\s+/g, ' ').trim();
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=in&q=${encodeURIComponent(cleanQ)}`;

      console.log(`[AUTOMATIC GEOCODING] ${label}: "${cleanQ}"`);
      const res = await fetch(url, { headers });
      if (!res.ok) continue;

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          if (!item.lat || !item.lon) continue;
          const evaluation = evaluateCandidateResult(item, addressInput, 'OpenStreetMap / Nominatim (Fallback)');
          allCandidates.push({
            latitude: parseFloat(parseFloat(item.lat).toFixed(6)),
            longitude: parseFloat(parseFloat(item.lon).toFixed(6)),
            displayName: item.display_name,
            provider: 'OpenStreetMap / Nominatim (Fallback)',
            querySent: query,
            evaluation
          });
        }

        // If we found a high score match, stop further attempts
        const highMatch = allCandidates.find(c => c.evaluation.matchScore >= 75 && !c.evaluation.isBroad);
        if (highMatch) break;
      }
    } catch (err) {
      console.warn(`[AUTOMATIC GEOCODING] Error during ${label}:`, err.message);
    }
  }

  // Select Best Result from Fallback
  if (allCandidates.length > 0) {
    allCandidates.sort((a, b) => b.evaluation.matchScore - a.evaluation.matchScore);
    const best = allCandidates[0];
    const { latitude, longitude, displayName, provider: selectedProvider, querySent, evaluation } = best;

    const isPrecise = evaluation.referenceQuality === 'PRECISE';
    const isApproximate = evaluation.referenceQuality === 'APPROXIMATE';
    const status = isPrecise ? 'GEOCODED' : (isApproximate ? 'APPROXIMATE' : 'FAILED');

    console.log(`[AUTOMATIC GEOCODING] Best Fallback Match Selected: "${displayName}"`);
    console.log(`[AUTOMATIC GEOCODING] Score: ${evaluation.matchScore}% | Confidence: ${evaluation.confidence} | Quality: ${evaluation.referenceQuality} | Type: ${evaluation.referenceType}`);
    console.log(`[AUTOMATIC GEOCODING] Fallback Coordinates (Unmanipulated): Lat ${latitude}, Lon ${longitude}`);
    console.log('=======================================================');

    return {
      success: isPrecise || isApproximate,
      status,
      confidence: evaluation.confidence,
      referenceType: evaluation.referenceType,
      referenceQuality: evaluation.referenceQuality,
      matchScore: evaluation.matchScore,
      houseMatch: evaluation.houseMatch,
      streetMatch: evaluation.streetMatch,
      areaMatch: evaluation.areaMatch,
      landmarkMatch: evaluation.landmarkMatch,
      pincodeMatch: evaluation.pincodeMatch,
      cityMatch: evaluation.cityMatch,
      stateMatch: evaluation.stateMatch,
      latitude,
      longitude,
      provider: selectedProvider,
      displayName,
      normalizedAddress,
      addressSent: querySent,
      geocodedDate: new Date().toISOString()
    };
  }

  console.log(`[AUTOMATIC GEOCODING] Result: FAILED (No candidates located by Primary or Fallback)`);
  console.log('=======================================================');

  return {
    success: false,
    status: 'FAILED',
    confidence: 'LOW',
    referenceType: 'LOCALITY',
    referenceQuality: 'INSUFFICIENT ADDRESS PRECISION',
    matchScore: 0,
    houseMatch: 'NO',
    streetMatch: 'NO',
    areaMatch: 'NO',
    landmarkMatch: 'NO',
    pincodeMatch: 'NO',
    cityMatch: 'NO',
    stateMatch: 'NO',
    normalizedAddress,
    addressSent: normalizedAddress,
    provider: 'Google Maps / Nominatim Fallback',
    error: 'Exact HR address could not be automatically located.'
  };
}

module.exports = {
  calculateDistanceMeters,
  formatDistance,
  getDynamicToleranceMeters,
  classifyDistance,
  normalizeAddress,
  buildFullAddressString,
  cleanDoorNumber,
  extractHouseNumber,
  extractPincode,
  evaluateCandidateResult,
  evaluateGoogleCandidate,
  geocodeAddress
};
