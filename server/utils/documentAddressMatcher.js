const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { getOcrWorker } = require('./imageValidator');

/**
 * Extract clean text from a PDF Buffer by parsing content streams.
 */
function extractTextFromPdfBuffer(pdfBuf) {
  if (!pdfBuf || pdfBuf.length === 0) return '';
  const content = pdfBuf.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let fullText = '';

  while ((match = streamRegex.exec(content)) !== null) {
    const rawStream = Buffer.from(match[1], 'latin1');
    let streamText = '';
    try {
      streamText = zlib.inflateSync(rawStream).toString('latin1');
    } catch (e) {
      try {
        streamText = zlib.inflateRawSync(rawStream).toString('latin1');
      } catch (e2) {
        streamText = rawStream.toString('latin1');
      }
    }

    const tjRegex = /(?:\[([\s\S]*?)\]\s*TJ|\(([\s\S]*?)\)\s*Tj|<([0-9a-fA-F]+)>\s*Tj)/g;
    let tMatch;
    while ((tMatch = tjRegex.exec(streamText)) !== null) {
      if (tMatch[1]) {
        const subRegex = /(?:<([0-9a-fA-F]+)>|\(([^)]*)\))/g;
        let sub;
        while ((sub = subRegex.exec(tMatch[1])) !== null) {
          if (sub[1]) {
            fullText += Buffer.from(sub[1], 'hex').toString('utf8') + ' ';
          } else if (sub[2]) {
            fullText += sub[2] + ' ';
          }
        }
        fullText += '\n';
      } else if (tMatch[2]) {
        fullText += tMatch[2] + '\n';
      } else if (tMatch[3]) {
        fullText += Buffer.from(tMatch[3], 'hex').toString('utf8') + '\n';
      }
    }
  }

  return fullText;
}

/**
 * Extract text from document file (PDF or image).
 */
async function extractTextFromDocument(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return '';
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    try {
      const buf = fs.readFileSync(filePath);
      const pdfText = extractTextFromPdfBuffer(buf);
      if (pdfText && pdfText.trim().length > 15) {
        return pdfText;
      }
    } catch (err) {
      console.warn('PDF stream extraction error:', err.message);
    }
  }

  // Fallback to Tesseract OCR (for images or raster PDFs)
  try {
    const worker = await getOcrWorker();
    if (worker) {
      const imgBuffer = fs.readFileSync(filePath);
      const ret = await worker.recognize(imgBuffer);
      if (ret && ret.data && ret.data.text) {
        return ret.data.text;
      }
    }
  } catch (ocrErr) {
    console.warn('OCR error during document extraction:', ocrErr.message);
  }

  return '';
}

/**
 * Clean OCR / document formatting artifacts
 */
function cleanDocumentText(rawText) {
  if (!rawText) return '';
  return rawText
    .replace(/Ad\s*dress/gi, 'Address')
    .replace(/Ori\s*ginal/gi, 'Original')
    .replace(/Con\s*firmed/gi, 'Confirmed')
    .replace(/Resi\s*dence/gi, 'Residence')
    .replace(/Per\s*manent/gi, 'Permanent')
    .replace(/T\s*AMIL\s*NADU/gi, 'TAMIL NADU')
    .replace(/SUR\s*APET/gi, 'SURAPET')
    .replace(/NA\s*GAR/gi, 'NAGAR')
    .replace(/ST\s*REET/gi, 'STREET')
    .replace(/R\s*O\s*AD/gi, 'ROAD')
    .replace(/[\r\n\t]+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .trim();
}

/**
 * Identify and isolate the residential address from document text.
 */
function extractAddressFromText(rawText) {
  if (!rawText || rawText.trim().length === 0) return '';
  const cleaned = cleanDocumentText(rawText);

  // 1. Search for address labels commonly on Aadhaar, Utility Bills, or BGV documents
  const match = cleaned.match(
    /(?:Original HR Address|Confirmed Address|Residential Address|Permanent Address|Current Address|Address|Addr)\s*:\s*([^:]+?)(?=(?:Original HR Address|Confirmed Address|Residence Type|Submission Timestamp|Date of Joining|Date|Ref:|GPS|Declaration|Reviewer|This is|$))/i
  );

  if (match && match[1].trim().length > 12) {
    let addr = match[1].trim().replace(/^,\s*|,\s*$/g, '');
    return addr;
  }

  // 2. Search for block with door number + 6-digit Indian pincode
  const pinMatch = cleaned.match(
    /(?:(?:no\.?|door|flat|plot)?\s*[\d/A-Za-z-]+\s*,)?[\w\s,/-]{8,140}\b[1-9][0-9]{5}\b[\w\s,-]{0,35}/i
  );
  if (pinMatch) {
    return pinMatch[0].trim().replace(/^,\s*|,\s*$/g, '');
  }

  // 3. If text is relatively short (e.g. an address card snippet), return cleaned text
  if (cleaned.length <= 160) {
    return cleaned;
  }

  return '';
}

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a, b) {
  if (!a || !b) return (a || b || '').length;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * String similarity ratio (0.0 to 1.0)
 */
function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(str1, str2);
  return (maxLen - dist) / maxLen;
}

/**
 * Normalize person name for comparison
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(?:mr|ms|mrs|dr|shri|smt|thiru|selvan|selvi|திரு|திருமதி)\.?\s+/gi, '')
    .replace(/[.,\-_/\\']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean extracted name string
 */
function cleanExtractedName(rawName) {
  if (!rawName) return '';
  let cleaned = rawName
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\b(?:mr|ms|mrs|dr|shri|smt|thiru|selvan|selvi|திரு|திருமதி)\.?\s+/gi, '')
    .replace(/\b(?:s\/o|d\/o|w\/o|c\/o|s\/w\/d of|so|do|wo|co|த\/பெ|க\/பெ)[\s\S]*/i, '')
    .replace(/[^a-zA-Z\u0B80-\u0BFF\s\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 2) return '';
  return cleaned;
}

/**
 * Extract Employee / Person Name from document OCR text (English & Tamil)
 */
function extractNameFromText(rawText, docType = '', candidateNames = []) {
  if (!rawText || rawText.trim().length === 0) return '';

  const cleanedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanedText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Passport Given Name + Surname check (English & Tamil)
  let givenName = '';
  let surname = '';
  for (const line of lines) {
    const gnMatch = line.match(/(?:Given\s*Name[s]?|கொடுக்கப்பட்ட\s*பெயர்)\s*[:\-\.]\s*([A-Za-z\u0B80-\u0BFF\s\.]+)/i);
    if (gnMatch) givenName = cleanExtractedName(gnMatch[1]);
    const snMatch = line.match(/(?:Surname|குடும்பப்\s*பெயர்)\s*[:\-\.]\s*([A-Za-z\u0B80-\u0BFF\s\.]+)/i);
    if (snMatch) surname = cleanExtractedName(snMatch[1]);
  }
  if (givenName && surname) {
    return `${givenName} ${surname}`;
  } else if (givenName || surname) {
    return givenName || surname;
  }

  // 2. Labelled regex check (English & Tamil)
  const labelRegex = /(?:Employee\s*Name|Holder'?s?\s*Name|Elector'?s?\s*Name|Consumer\s*Name|Customer\s*Name|Applicant\s*Name|Tenant\s*Name|Tenant|Lessee|Full\s*Name|Name|பணியாளர்\s*பெயர்|வாக்காளர்\s*பெயர்|நுகர்வோர்\s*பெயர்|வாடிக்கையாளர்\s*பெயர்|குத்தகைதாரர்|வாடகைதாரர்|முழு\s*பெயர்|பெயர்)\s*[:\-\.]\s*([A-Za-z\u0B80-\u0BFF\s\.]+)/i;

  for (const line of lines) {
    const match = line.match(labelRegex);
    if (match && match[1]) {
      const candidate = cleanExtractedName(match[1]);
      if (candidate.length >= 3) {
        return candidate;
      }
    }
  }

  // 3. Aadhaar front heuristic:
  // Look for line immediately before DOB / Year of Birth / பிறந்த தேதி / Gender / Male / Female
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/(?:DOB|Year of Birth|Birth|பிறந்த தேதி|ஆண்|பெண்|Male|Female)\b/i.test(line)) {
      for (let prevIdx = i - 1; prevIdx >= Math.max(0, i - 3); prevIdx--) {
        const prevLine = lines[prevIdx];
        if (
          !/(?:Government|India|Unique|Identification|Authority|Aadhaar|UIDAI|Mera|அரசு|ஆணையம்|ஆதார்|Download|Enrolment)/i.test(prevLine) &&
          !/\d{4}/.test(prevLine) &&
          /[A-Za-z\u0B80-\u0BFF]{3,}/.test(prevLine)
        ) {
          const candidate = cleanExtractedName(prevLine);
          if (candidate.length >= 3) {
            return candidate;
          }
        }
      }
    }
  }

  // 4. Candidate Names Match in Lines (Fuzzy Anchor)
  const normCandidates = (Array.isArray(candidateNames) ? candidateNames : [candidateNames])
    .map(c => normalizeName(c))
    .filter(Boolean);

  let bestFuzzyLine = '';
  let bestFuzzyScore = 0;

  for (const line of lines) {
    if (
      line.length < 3 || line.length > 50 ||
      /\b(?:street|nagar|road|flat|door|plot|chennai|tamil nadu|pincode|india|distributor|consumer|cylinder|refill|help@|www\.)\b/i.test(line) ||
      /\d{3,}/.test(line)
    ) {
      continue;
    }

    const normLine = normalizeName(line);
    for (const cand of normCandidates) {
      const sim = stringSimilarity(normLine, cand);
      if (sim > bestFuzzyScore) {
        bestFuzzyScore = sim;
        bestFuzzyLine = cleanExtractedName(line);
      }
    }
  }

  if (bestFuzzyScore >= 0.70 && bestFuzzyLine) {
    return bestFuzzyLine;
  }

  // 5. Fallback: Find first line looking like a clean person's name
  for (const line of lines) {
    if (
      line.length >= 4 && line.length <= 40 &&
      /^[A-Za-z\u0B80-\u0BFF\s\.]+$/.test(line) &&
      !/(?:government|india|republic|driving|licence|election|commission|passport|agreement|bill|consumer|gas|lpg|authority)/i.test(line)
    ) {
      const candidate = cleanExtractedName(line);
      if (candidate.split(' ').length >= 1 && candidate.length >= 3) {
        return candidate;
      }
    }
  }

  return '';
}

/**
 * Compare target employee name with document name.
 * Ignores case, extra spaces, minor punctuation, initials and small spelling variations.
 * Does not mark MATCH if clearly belonging to another person.
 */
function compareNameComponents(targetName, documentName, documentFullText = '') {
  if (!targetName || !targetName.trim()) {
    return { match: 'NOT MATCH', score: 0, reason: 'Target name missing' };
  }

  const normTarget = normalizeName(targetName);
  const normDoc = normalizeName(documentName);

  if (!normDoc) {
    if (documentFullText) {
      const normFull = normalizeName(documentFullText);
      if (normFull.includes(normTarget)) {
        return { match: 'MATCH', score: 90, details: 'Target name found in full document text.' };
      }
    }
    return { match: 'NOT MATCH', score: 0, reason: 'Document name not readable.' };
  }

  // 1. Exact Match
  if (normTarget === normDoc) {
    return { match: 'MATCH', score: 100, details: 'Exact match.' };
  }

  // 2. Token Breakdown
  const targetTokens = normTarget.split(' ').filter(Boolean);
  const docTokens = normDoc.split(' ').filter(Boolean);

  const targetMainTokens = targetTokens.filter(t => t.length > 1);
  const docMainTokens = docTokens.filter(t => t.length > 1);

  // 3. Token set match (e.g. "Kumar Sharan" vs "Sharan Kumar")
  const targetSet = new Set(targetTokens);
  const docSet = new Set(docTokens);
  const isSubset = targetTokens.every(t => docSet.has(t));
  const isDocSubset = docTokens.every(t => targetSet.has(t));

  if (isSubset && isDocSubset) {
    return { match: 'MATCH', score: 98, details: 'All name tokens match.' };
  }

  // 4. Initials Handling:
  // If all main tokens match, and initials differ only by presence or position
  // e.g. "Suresh Kumar R" vs "R Suresh Kumar" vs "Suresh Kumar"
  const mainTargetSet = new Set(targetMainTokens);
  const mainDocSet = new Set(docMainTokens);
  const mainTokensMatch = targetMainTokens.length > 0 &&
    docMainTokens.length > 0 &&
    targetMainTokens.every(t => mainDocSet.has(t)) &&
    docMainTokens.every(t => mainTargetSet.has(t));

  if (mainTokensMatch) {
    return {
      match: 'MATCH',
      score: 95,
      details: 'All main name components match with minor initial variation.'
    };
  }

  // Check if one has an initial and other has full word starting with that initial
  if (targetMainTokens.length > 0 && docMainTokens.length > 0) {
    let sharedMainCount = 0;
    for (const t of targetMainTokens) {
      if (docMainTokens.includes(t)) sharedMainCount++;
    }

    if (sharedMainCount >= Math.min(targetMainTokens.length, docMainTokens.length)) {
      return {
        match: 'MATCH',
        score: 92,
        details: 'Core names match.'
      };
    }
  }

  // 5. String Similarity / Spelling Variations
  const fullSim = stringSimilarity(normTarget, normDoc);
  if (fullSim >= 0.85) {
    return {
      match: 'MATCH',
      score: Math.round(fullSim * 100),
      details: `High name similarity (${Math.round(fullSim * 100)}%).`
    };
  }

  // 6. Partial match check (at least one main word matches, or similarity 0.65 to 0.84)
  let anySharedMain = false;
  for (const t of targetMainTokens) {
    for (const d of docMainTokens) {
      if (t === d || stringSimilarity(t, d) >= 0.80) {
        anySharedMain = true;
        break;
      }
    }
    if (anySharedMain) break;
  }

  if (anySharedMain || fullSim >= 0.65) {
    return {
      match: 'PARTIAL MATCH',
      score: Math.round(Math.max(fullSim * 100, 65)),
      details: `Partial name match (${Math.round(fullSim * 100)}%).`
    };
  }

  // 7. Clearly different person!
  return {
    match: 'NOT MATCH',
    score: Math.round(fullSim * 100),
    details: 'Name does not match.'
  };
}

/**
 * Extract 6-digit Indian pincode
 */
function extractPincode(str) {
  if (!str) return '';
  const m = str.match(/\b([1-9][0-9]{5})\b/);
  return m ? m[1] : '';
}

/**
 * Extract house/door/flat number
 */
function extractHouseNumber(str) {
  if (!str) return '';
  const m = str.match(/\b(?:no\.?|door|flat|plot|house)?\s*([0-9]+[a-z]?[\/\-]?[0-9]*[a-z]?)\b/i);
  return m ? m[1].toUpperCase() : '';
}

/**
 * Standardize text for loose abbreviation & formatting matching
 */
function normalizeForComparison(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[,\.\-\/\\#]/g, ' ')
    .replace(/\bst\b|\bst\.\b/g, 'street')
    .replace(/\brd\b|\brd\.\b/g, 'road')
    .replace(/\bave\b|\bave\.\b|\bav\b/g, 'avenue')
    .replace(/\bln\b/g, 'lane')
    .replace(/\btn\b/g, 'tamil nadu')
    .replace(/\bind\b/g, 'india')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compare target address against extracted document text component by component.
 * Evaluates: House Number, Street, Area, City, State, and Pincode.
 * Ignores casing, extra spaces, commas, line breaks, and common abbreviations.
 */
function compareAddressComponents(targetAddress, documentText, extractedAddress) {
  if (!documentText || documentText.trim().length < 8) {
    return {
      match: 'NOT MATCH',
      score: 0,
      readable: false,
      components: {
        houseNumber: 'NOT READ',
        street: 'NOT READ',
        area: 'NOT READ',
        city: 'NOT READ',
        state: 'NOT READ',
        pincode: 'NOT READ'
      }
    };
  }

  const normTarget = normalizeForComparison(targetAddress);
  const normDoc = normalizeForComparison(documentText);
  const rawTargetLower = (targetAddress || '').toLowerCase();
  const rawDocLower = (documentText || '').toLowerCase();

  let totalScore = 0;

  // 1. PINCODE (25 pts)
  const targetPin = extractPincode(targetAddress);
  const docPin = extractPincode(extractedAddress || documentText);
  let pincodeStatus = 'NOT CHECKED';

  if (targetPin && docPin) {
    if (targetPin === docPin) {
      totalScore += 25;
      pincodeStatus = 'MATCH';
    } else {
      totalScore -= 25; // Strict penalty for postal code mismatch
      pincodeStatus = 'NOT MATCH';
    }
  } else if (targetPin) {
    if (rawDocLower.includes(targetPin)) {
      totalScore += 25;
      pincodeStatus = 'MATCH';
    } else {
      pincodeStatus = 'NOT FOUND';
    }
  }

  // 2. HOUSE / DOOR NUMBER (25 pts)
  const targetHouse = extractHouseNumber(targetAddress);
  let houseStatus = 'N/A';

  if (targetHouse) {
    const cleanHouse = targetHouse.toLowerCase().replace(/[\s\/\-]/g, '');
    const cleanDoc = rawDocLower.replace(/[\s\/\-]/g, '');

    if (cleanDoc.includes(cleanHouse) || normDoc.includes(targetHouse.toLowerCase())) {
      totalScore += 25;
      houseStatus = 'MATCH';
    } else {
      // Check if another explicit house number was detected
      const docHouse = extractHouseNumber(extractedAddress);
      if (docHouse && docHouse !== targetHouse) {
        totalScore -= 20; // Explicit mismatch
        houseStatus = 'NOT MATCH';
      } else {
        houseStatus = 'NOT FOUND';
      }
    }
  } else {
    // If target has no house number, neutral
    totalScore += 15;
    houseStatus = 'MATCH';
  }

  // 3. STREET / ROAD (20 pts)
  let streetStatus = 'NOT MATCH';
  const cleanDocSpaceless = rawDocLower.replace(/\s+/g, '');
  const streetTokens = targetAddress
    .split(/[\s,./-]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 4 && !['india', 'tamil', 'nadu', 'tamilnadu', 'chennai', 'street', 'road'].includes(w));

  let matchedTokens = 0;
  for (const token of streetTokens) {
    if (rawDocLower.includes(token) || cleanDocSpaceless.includes(token.replace(/\s+/g, ''))) {
      matchedTokens++;
    }
  }

  if (streetTokens.length > 0) {
    const ratio = matchedTokens / streetTokens.length;
    if (ratio >= 0.5) {
      totalScore += 20;
      streetStatus = 'MATCH';
    } else if (matchedTokens > 0) {
      totalScore += 12;
      streetStatus = 'PARTIAL MATCH';
    }
  } else {
    totalScore += 15;
    streetStatus = 'MATCH';
  }

  // 4. AREA / LOCALITY (15 pts)
  let areaStatus = 'NOT MATCH';
  const areaKeywords = [
    'vinayagapuram', 'surapet', 'velmurugan', 'anna nagar', 't nagar', 'velachery',
    'ambattur', 'tambaram', 'guindy', 'porur', 'madhavaram', 'redhills', 'vadapalani',
    'perambur', 'mylapore', 'alwarpet', 'adyar', 'kolathur', 'royapettah'
  ];

  let areaMatched = false;
  for (const a of areaKeywords) {
    if (rawTargetLower.includes(a) && (rawDocLower.includes(a) || cleanDocSpaceless.includes(a))) {
      areaMatched = true;
      break;
    }
  }

  if (areaMatched) {
    totalScore += 15;
    areaStatus = 'MATCH';
  } else {
    if (matchedTokens >= 2) {
      totalScore += 10;
      areaStatus = 'PARTIAL MATCH';
    }
  }

  // 5. CITY (10 pts)
  let cityStatus = 'NOT MATCH';
  const majorCities = [
    'chennai', 'bengaluru', 'bangalore', 'hyderabad', 'mumbai', 'delhi',
    'coimbatore', 'madurai', 'trichy', 'salem', 'tirunelveli', 'vellore'
  ];

  for (const city of majorCities) {
    if (rawTargetLower.includes(city) && (rawDocLower.includes(city) || cleanDocSpaceless.includes(city))) {
      totalScore += 10;
      cityStatus = 'MATCH';
      break;
    }
  }

  // 6. STATE (5 pts)
  let stateStatus = 'NOT MATCH';
  const states = ['tamil nadu', 'tamilnadu', 'karnataka', 'kerala', 'andhra', 'telangana', 'maharashtra'];
  for (const state of states) {
    const cleanState = state.replace(/\s+/g, '');
    if ((rawTargetLower.includes(state) || rawTargetLower.includes(cleanState)) &&
        (rawDocLower.includes(state) || cleanDocSpaceless.includes(cleanState))) {
      totalScore += 5;
      stateStatus = 'MATCH';
      break;
    }
  }

  totalScore = Math.max(0, Math.min(100, totalScore));

  // Determine MATCH / PARTIAL MATCH / NOT MATCH
  let match = 'NOT MATCH';
  if (pincodeStatus === 'NOT MATCH' || houseStatus === 'NOT MATCH') {
    match = 'NOT MATCH';
  } else if (totalScore >= 70) {
    match = 'MATCH';
  } else if (totalScore >= 40) {
    match = 'PARTIAL MATCH';
  } else {
    match = 'NOT MATCH';
  }

  return {
    match,
    score: totalScore,
    readable: true,
    components: {
      houseNumber: houseStatus,
      street: streetStatus,
      area: areaStatus,
      city: cityStatus,
      state: stateStatus,
      pincode: pincodeStatus
    }
  };
}

/**
 * Main Automatic Address Proof Matching Function
 *
 * @param {Object} employee - Employee database record
 * @param {Object} progress - Verification progress record
 * @returns {Promise<Object>} Complete matching report
 */
async function performDocumentAddressMatch(employee, progress) {
  if (!progress || !progress.document_path) {
    return {
      success: false,
      documentAvailable: false,
      extractedAddress: null,
      hrAddressMatch: 'NOT MATCH',
      employeeConfirmedAddressMatch: 'NOT MATCH',
      overallResult: 'REVIEW REQUIRED',
      statusMessage: 'NO DOCUMENT ATTACHED',
      details: 'No address proof document has been uploaded for this case.'
    };
  }

  const docPath = progress.document_path;
  const backDocPath = progress.document_back_path;

  let rawDocText = '';
  if (docPath && fs.existsSync(docPath)) {
    try {
      rawDocText = await extractTextFromDocument(docPath);
    } catch (fErr) {
      console.warn('Front document OCR error:', fErr.message);
    }
  }

  let backDocText = '';
  if (backDocPath && fs.existsSync(backDocPath)) {
    try {
      backDocText = await extractTextFromDocument(backDocPath);
    } catch (bErr) {
      console.warn('Back document OCR error:', bErr.message);
    }
  }

  const hrAddress = employee?.hr_current_address || employee?.address || '';
  const empConfirmedAddress = progress?.submitted_address || hrAddress;
  const hrName = employee?.employee_name || employee?.name || '';
  const empConfirmedName = progress?.submitted_name || hrName;

  const combinedDocText = [rawDocText, backDocText].filter(Boolean).join('\n');
  const extractedAddress = extractAddressFromText(combinedDocText) || extractAddressFromText(backDocText) || extractAddressFromText(rawDocText);
  const extractedName = extractNameFromText(combinedDocText, progress?.document_type, [hrName, empConfirmedName]) ||
                        extractNameFromText(rawDocText, progress?.document_type, [hrName, empConfirmedName]) ||
                        extractNameFromText(backDocText, progress?.document_type, [hrName, empConfirmedName]);

  const addressCouldBeRead = Boolean(
    (extractedAddress && extractedAddress.trim().length >= 10) ||
    (combinedDocText && combinedDocText.trim().length >= 25)
  );

  const hrNameComparison = compareNameComponents(hrName, extractedName, combinedDocText);
  const empNameComparison = compareNameComponents(empConfirmedName, extractedName, combinedDocText);

  const isHrNameMatch = hrNameComparison.match === 'MATCH';
  const isEmpNameMatch = empNameComparison.match === 'MATCH';
  const isHrNamePartial = hrNameComparison.match === 'PARTIAL MATCH';
  const isEmpNamePartial = empNameComparison.match === 'PARTIAL MATCH';
  const isHrNameNotMatch = hrNameComparison.match === 'NOT MATCH';
  const isEmpNameNotMatch = empNameComparison.match === 'NOT MATCH';

  const isNameMatch = isHrNameMatch || isEmpNameMatch;
  const isNamePartial = !isNameMatch && (isHrNamePartial || isEmpNamePartial);
  const isNameNotMatch = isHrNameNotMatch && isEmpNameNotMatch;
  const nameOverallStatus = isNameMatch ? 'MATCH' : isNamePartial ? 'PARTIAL' : 'NOT MATCH';

  if (!addressCouldBeRead) {
    return {
      success: true,
      documentAvailable: true,
      documentType: progress.document_type || 'Address Proof',
      fileName: progress.document_original_name || (docPath ? path.basename(docPath) : 'Front Document'),
      backFileName: progress.document_back_original_name || (backDocPath ? path.basename(backDocPath) : null),
      extractedAddress: 'Address text could not be clearly extracted from document.',
      extractedName: extractedName || 'Name text could not be clearly extracted.',
      hrNameMatch: hrNameComparison.match,
      hrNameScore: hrNameComparison.score,
      employeeConfirmedNameMatch: empNameComparison.match,
      employeeNameScore: empNameComparison.score,
      nameMatchStatus: nameOverallStatus,
      hrAddressMatch: 'NOT MATCH',
      employeeConfirmedAddressMatch: 'NOT MATCH',
      overallResult: isNameNotMatch ? 'NOT MATCHED' : 'REVIEW REQUIRED',
      statusMessage: isNameNotMatch ? 'NAME NOT MATCHED' : 'ADDRESS COULD NOT BE READ – REVIEW REQUIRED',
      readable: false,
      components: {
        name: {
          hr: hrNameComparison.match,
          emp: empNameComparison.match,
          status: nameOverallStatus
        },
        hr: {},
        emp: {}
      }
    };
  }

  const hrComparison = compareAddressComponents(hrAddress, combinedDocText, extractedAddress);
  const empComparison = compareAddressComponents(empConfirmedAddress, combinedDocText, extractedAddress);

  // Address matching status
  const isHrMatch = hrComparison.match === 'MATCH';
  const isEmpMatch = empComparison.match === 'MATCH';
  const isHrPartial = hrComparison.match === 'PARTIAL MATCH';
  const isEmpPartial = empComparison.match === 'PARTIAL MATCH';

  const isAddressMatch = isHrMatch || isEmpMatch;
  const isAddressPartial = !isAddressMatch && (isHrPartial || isEmpPartial);
  const isAddressNotMatch = !isAddressMatch && !isAddressPartial;

  // Overall Result Evaluation considering BOTH Name and Address:
  // - If both match: MATCHED
  // - If one is partial (and none is clearly NOT MATCH): REVIEW REQUIRED
  // - If Name or Address clearly does not match: NOT MATCHED
  let overallResult = 'REVIEW REQUIRED';
  let statusMessage = 'REVIEW REQUIRED';

  if (isNameNotMatch || isAddressNotMatch) {
    overallResult = 'NOT MATCHED';
    if (isNameNotMatch && isAddressNotMatch) {
      statusMessage = 'NAME & ADDRESS NOT MATCHED';
    } else if (isNameNotMatch) {
      statusMessage = 'NAME NOT MATCHED';
    } else {
      statusMessage = 'ADDRESS NOT MATCHED';
    }
  } else if (isNameMatch && isAddressMatch) {
    overallResult = 'MATCHED';
    statusMessage = 'MATCHED';
  } else {
    overallResult = 'REVIEW REQUIRED';
    statusMessage = 'REVIEW REQUIRED';
  }

  return {
    success: true,
    documentAvailable: true,
    documentType: progress.document_type || 'Address Proof',
    fileName: progress.document_original_name || (docPath ? path.basename(docPath) : 'Front Document'),
    backFileName: progress.document_back_original_name || (backDocPath ? path.basename(backDocPath) : null),
    extractedAddress: extractedAddress || rawDocText.substring(0, 160).trim(),
    extractedName: extractedName || 'Name text could not be clearly extracted.',
    hrNameMatch: hrNameComparison.match,
    hrNameScore: hrNameComparison.score,
    employeeConfirmedNameMatch: empNameComparison.match,
    employeeNameScore: empNameComparison.score,
    nameMatchStatus: nameOverallStatus,
    hrAddressMatch: hrComparison.match,
    hrMatchScore: hrComparison.score,
    employeeConfirmedAddressMatch: empComparison.match,
    employeeMatchScore: empComparison.score,
    overallResult,
    statusMessage,
    readable: true,
    components: {
      name: {
        hr: hrNameComparison.match,
        emp: empNameComparison.match,
        status: nameOverallStatus
      },
      hr: hrComparison.components,
      emp: empComparison.components
    }
  };
}

module.exports = {
  performDocumentAddressMatch,
  extractTextFromDocument,
  extractAddressFromText,
  extractNameFromText,
  compareNameComponents,
  compareAddressComponents,
  extractTextFromPdfBuffer
};
