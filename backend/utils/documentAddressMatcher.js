const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {
  getIndianLanguageWorker,
  detectDocumentLanguage,
  normalizeIndicNumerals,
  transliterateIndicToLatin
} = require('./indianLanguageOcr');

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
 * Uses multi-language Tesseract worker supporting English, Hindi, Tamil, Telugu, Kannada, Malayalam.
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

  // Fallback to 6-Language Tesseract OCR (for images or raster PDFs)
  try {
    const worker = await getIndianLanguageWorker();
    if (worker) {
      const imgBuffer = fs.readFileSync(filePath);
      const ret = await worker.recognize(imgBuffer);
      if (ret && ret.data && ret.data.text) {
        return ret.data.text;
      }
    }
  } catch (ocrErr) {
    console.warn('Multi-language OCR error during document extraction:', ocrErr.message);
  }

  return '';
}

/**
 * Clean OCR / document formatting artifacts and normalize Indic numerals
 */
function cleanDocumentText(rawText) {
  if (!rawText) return '';
  const normalized = normalizeIndicNumerals(rawText);
  return normalized
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
 * Supports English, Hindi, Tamil, Telugu, Kannada, and Malayalam address labels.
 */
function extractAddressFromText(rawText, isTargetLatin = true) {
  if (!rawText || rawText.trim().length === 0) return '';
  const cleanedText = cleanDocumentText(rawText);

  let rawAddr = '';

  // 1. If target is Latin, search specifically for English Address block first
  // Note: address blocks may contain internal colons (e.g. "Address: C/O: Elumalai...", "PO:Egmore", "DIST:Chennai")
  // So we capture continuously through the 6-digit Indian PIN code.
  if (isTargetLatin) {
    const engMatch = cleanedText.match(
      /(?:Residential Address|Permanent Address|Current Address|Confirmed Address|Original HR Address|Address|Addr)\s*[:\-\.]?\s*([\s\S]+?\b[1-9][0-9]{5}\b)/i
    );
    if (engMatch && engMatch[1].trim().length >= 10) {
      rawAddr = engMatch[1].trim();
    }
  }

  // 2. Multilingual address label check across English, Tamil, Hindi, Telugu, Kannada, Malayalam
  if (!rawAddr) {
    const multiMatch = cleanedText.match(
      /(?:Residential Address|Permanent Address|Current Address|Confirmed Address|Original HR Address|Address|Addr|முகவரி|இருப்பிட முகவரி|நிரந்தர முகவரி|पता|स्थाई पता|वर्तमान पता|निवासी|చిరునామా|శాశ్వత చిరునామా|ప్రస్తుత చిరునామా|ವಿಳಾಸ|ಖಾಯಂ ವಿಳಾಸ|ಪ್ರಸ್ತುತ ವಿಳಾಸ|മേൽവിലാസം|സ്ഥിരമായ മേൽവിലാസം|നിലവിലെ മേൽവിലാസം)\s*[:\-\.]?\s*([\s\S]+?\b[1-9][0-9]{5}\b)/i
    );
    if (multiMatch && multiMatch[1].trim().length >= 10) {
      rawAddr = multiMatch[1].trim();
    }
  }

  // 3. Search for Care-of / Son-of / Daughter-of / Wife-of patterns in English and Indian languages
  if (!rawAddr) {
    const coMatch = cleanedText.match(
      /(?:C\/O|S\/O|D\/O|W\/O|Care of|Son of|Daughter of|Wife of|த\/பெ|க\/பெ|மனைவி|மகன்|மகள்|आत्मज|सुपुत्र|सुपुत्री|पत्नी|केयर ऑफ|కుమారుడు|కుమార్తె|భార్య|ಮಗ|ಮಗಳು|ಹೆಂಡತಿ|മകൻ|മകൾ|ഭാര്യ)\s*[:\-\.]?\s*([\s\S]+?\b[1-9][0-9]{5}\b)/i
    );
    if (coMatch && coMatch[0].trim().length >= 12) {
      rawAddr = coMatch[0].trim();
    }
  }

  // 4. Search for block with door number / street + 6-digit Indian pincode
  if (!rawAddr) {
    const pinMatch = cleanedText.match(
      /(?:(?:no\.?|door|flat|plot|எண்|सं|నెం|ಸಂ|നം)?\s*[\d/A-Za-z-]+\s*[,:\-\s])[\s\S]+?\b[1-9][0-9]{5}\b/i
    );
    if (pinMatch) {
      rawAddr = pinMatch[0].trim();
    }
  }

  // 5. Fallback: If text is relatively short (e.g. an address card snippet)
  if (!rawAddr) {
    if (cleanedText.length <= 160 && /\b[1-9][0-9]{5}\b/.test(cleanedText)) {
      rawAddr = cleanedText;
    } else {
      return '';
    }
  }

  // Sanitize and clean the extracted address string
  let result = rawAddr;

  if (isTargetLatin) {
    // Strip isolated non-ASCII glyphs (e.g. Tamil/Telugu OCR noise in English block)
    result = result.replace(/[^\x00-\x7F]+/g, ' ');
    // Strip OCR artifact 'see <number>'
    result = result.replace(/\bsee\s*\d+\b/gi, ' ');
    // Strip isolated numbers before labels e.g. '8 DIST:' -> 'DIST:'
    result = result.replace(/\b\d+\s+(DIST:)/gi, '$1');
  }

  // Truncate anything trailing after the 6-digit pincode (such as stray Kannada glyphs 'ಸವ್')
  result = result.replace(/(\b[1-9][0-9]{5}\b)[\s\S]*$/i, (m, p1) => p1);

  // Clean formatting: commas, extra spaces, line breaks
  result = result
    .replace(/[\r\n\t]+/g, ', ')
    .replace(/\b(DOCTOR|DR|NO)\s*,\s*/gi, '$1 ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();

  return result;
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
 * Clean extracted name string across English and Indian scripts
 */
function cleanExtractedName(rawName, candidateNames = []) {
  if (!rawName) return '';
  let cleaned = rawName
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\b(?:mr|ms|mrs|dr|shri|smt|thiru|selvan|selvi|திரு|திருமதி|श्री|श्रीमती|శ్రీ|శ్రీమతి|ಶ್ರೀ|ಶ್ರೀಮತಿ|ശ്രീ|ശ്രീമതി)\.?\s+/gi, '')
    .replace(/\b(?:s\/o|d\/o|w\/o|c\/o|s\/w\/d of|so|do|wo|co|த\/பெ|க\/பெ|மனைவி|மகன்|மகள்|आत्मज|सुपुत्र|सुपुत्री|पत्नी|केयर ऑफ|కుమారుడు|కుమార్తె|భార్య|ಮಗ|ಮಗಳು|ಹೆಂಡತಿ|മകൻ|മകൾ|ഭാര്യ)[\s\S]*/i, '')
    .trim();

  const cands = (Array.isArray(candidateNames) ? candidateNames : [candidateNames]).filter(Boolean);
  const isCandidateLatin = cands.length > 0 && cands.some(c => /^[A-Za-z\s.]+$/.test(c.trim()));

  if (isCandidateLatin) {
    // If target candidate is in Latin script, strip isolated non-Latin Indic characters and symbols
    cleaned = cleaned.replace(/[\u0900-\u0D7F]+/g, ' ');
    cleaned = cleaned.replace(/[^A-Za-z\s.]/g, ' ');
  } else {
    cleaned = cleaned.replace(/[^a-zA-Z\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\s\.]/g, ' ');
  }

  // Tokenize and clean stray OCR noise
  let tokens = cleaned.split(/\s+/).filter(Boolean);

  // Strip leading and trailing 1-letter lowercase noise tokens (e.g. 'y', 'x')
  while (tokens.length > 1 && tokens[tokens.length - 1].length === 1 && /^[a-z]$/.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  while (tokens.length > 1 && tokens[0].length === 1 && /^[a-z]$/.test(tokens[0])) {
    tokens.shift();
  }

  // If candidate is Latin and we have multiple tokens, verify against candidate words
  if (isCandidateLatin && tokens.length > 1) {
    const candWords = cands.flatMap(c => c.toLowerCase().split(/\s+/).filter(w => w.length >= 3));
    const matchingTokens = tokens.filter(t => {
      const tLower = t.toLowerCase();
      return candWords.some(cw => cw === tLower || stringSimilarity(cw, tLower) >= 0.75);
    });
    if (matchingTokens.length > 0) {
      const refined = tokens.filter(t => {
        const tLower = t.toLowerCase();
        if (candWords.some(cw => cw === tLower || stringSimilarity(cw, tLower) >= 0.75)) return true;
        if (/^[A-Z]\.?$/.test(t)) return true; // valid uppercase initial
        return false;
      });
      if (refined.length > 0) {
        tokens = refined;
      }
    }
  }

  cleaned = tokens.join(' ').trim();
  if (cleaned.length < 2) return '';
  return cleaned;
}

/**
 * Extract Employee / Person Name from document OCR text.
 * Supports English, Hindi, Tamil, Telugu, Kannada, and Malayalam.
 */
function extractNameFromText(rawText, docType = '', candidateNames = []) {
  if (!rawText || rawText.trim().length === 0) return '';

  const cleanedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanedText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Passport Given Name + Surname check (English & Indian Languages)
  let givenName = '';
  let surname = '';
  for (const line of lines) {
    const gnMatch = line.match(/(?:Given\s*Name[s]?|கொடுக்கப்பட்ட\s*பெயர்|दिया\s*गया\s*नाम|ఇచ్చిన\s*పేరు|ಹೆಸರು|നൽകിയ\s*പേര്)\s*[:\-\.]\s*([A-Za-z\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\s\.]+)/i);
    if (gnMatch) givenName = cleanExtractedName(gnMatch[1], candidateNames);
    const snMatch = line.match(/(?:Surname|குடும்பப்\s*பெயர்|उपनाम|ఇంటిపేరు|ಉಪನಾಮ|കുടുംബപ്പேര്)\s*[:\-\.]\s*([A-Za-z\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\s\.]+)/i);
    if (snMatch) surname = cleanExtractedName(snMatch[1], candidateNames);
  }
  if (givenName && surname) {
    return `${givenName} ${surname}`;
  } else if (givenName || surname) {
    return givenName || surname;
  }

  // 2. Labelled regex check (English, Hindi, Tamil, Telugu, Kannada, Malayalam)
  const labelRegex = /(?:Employee\s*Name|Holder'?s?\s*Name|Elector'?s?\s*Name|Consumer\s*Name|Customer\s*Name|Applicant\s*Name|Tenant\s*Name|Tenant|Lessee|Full\s*Name|Name|பணியாளர்\s*பெயர்|வாக்காளர்\s*பெயர்|நுகர்வோர்\s*பெயர்|வாடிக்கையாளர்\s*பெயர்|குத்தகைதாரர்|வாடகைதாரர்|முழு\s*பெயர்|பெயர்|कर्मचारी\s*का\s*नाम|मतदाता\s*का\s*नाम|उपभोक्ता\s*का\s*नाम|ग्राहक\s*का\s*नाम|आवेदक\s*का\s*नाम|किरायेदार\s*का\s*नाम|पूरा\s*नाम|नाम|ఉద్యోగి\s*పేరు|ఓటరు\s*పేరు|వినియోగదారు\s*పేరు|పూర్తి\s*పేరు|పేరు|ನೌಕರರ\s*ಹೆಸರು|ಮತದಾರರ\s*ಹೆಸರು|ಗ್ರಾಹಕರ\s*ಹೆಸರು|ಪೂರ್ಣ\s*ಹೆಸರು|ಹೆಸರು|ജീവനക്കാരന്റെ\s*പേര്|വോട്ടറുടെ\s*പേര്|ഉപഭോക്തൃ\s*പേര്|പൂർണ്ണ\s*പേര്|പേര്)\s*[:\-\.]\s*([A-Za-z\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\s\.]+)/i;

  for (const line of lines) {
    const match = line.match(labelRegex);
    if (match && match[1]) {
      const candidate = cleanExtractedName(match[1], candidateNames);
      if (candidate.length >= 3) {
        return candidate;
      }
    }
  }

  // 3. Aadhaar front heuristic:
  // Look for line immediately before DOB / Year of Birth / Gender in English and Indian languages
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/(?:DOB|Year of Birth|Birth|பிறந்த தேதி|பிறந்த நாள்|ஆண்|பெண்|Male|Female|जन्म तिथि|पुरुष|महिला|पुట్టిన తేదీ|పురుషుడు|స్త్రీ|ಹುಟ್ಟಿದ ದಿನಾಂಕ|ಪುರುಷ|ಮಹಿಳೆ|ജനന തീയതി|പുരുഷൻ|സ്ത്രീ)\b/i.test(line)) {
      for (let prevIdx = i - 1; prevIdx >= Math.max(0, i - 3); prevIdx--) {
        const prevLine = lines[prevIdx];
        if (
          !/(?:Government|India|Unique|Identification|Authority|Aadhaar|UIDAI|Mera|அரசு|ஆணையம்|ஆதார்|भारत|सरकार|प्राधिकरण|ఆధార్|ಪ್ರಭುತ್ವ|ಸರ್ಕಾರ|ആധാർ|Download|Enrolment)/i.test(prevLine) &&
          !/\d{4}/.test(prevLine) &&
          /[A-Za-z\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]{3,}/.test(prevLine)
        ) {
          const candidate = cleanExtractedName(prevLine, candidateNames);
          if (candidate.length >= 3) {
            return candidate;
          }
        }
      }
    }
  }

  // 4. Candidate Names Match in Lines (Fuzzy Anchor + Transliteration)
  const normCandidates = (Array.isArray(candidateNames) ? candidateNames : [candidateNames])
    .map(c => normalizeName(c))
    .filter(Boolean);

  let bestFuzzyLine = '';
  let bestFuzzyScore = 0;

  for (const line of lines) {
    if (
      line.length < 3 || line.length > 60 ||
      /\b(?:street|nagar|road|flat|door|plot|chennai|tamil nadu|pincode|india|distributor|consumer|cylinder|refill|help@|www\.|मार्ग|सड़क|नगर|தெரு|நகர்|వీధి|నగర్|ರಸ್ತೆ|ನಗರ|റോഡ്|നഗർ)\b/i.test(line) ||
      /\d{3,}/.test(line)
    ) {
      continue;
    }

    const normLine = normalizeName(line);
    const transLine = normalizeName(transliterateIndicToLatin(line));

    for (const cand of normCandidates) {
      const sim = Math.max(stringSimilarity(normLine, cand), stringSimilarity(transLine, cand));
      if (sim > bestFuzzyScore) {
        bestFuzzyScore = sim;
        bestFuzzyLine = cleanExtractedName(line, candidateNames);
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
      /^[A-Za-z\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\s\.]+$/.test(line) &&
      !/(?:government|india|republic|driving|licence|election|commission|passport|agreement|bill|consumer|gas|lpg|authority|सरकार|प्राधिकरण|அரசு|ஆணையம்|ప్రభుత్వం|ಸರ್ಕಾರ|സർക്കാർ)/i.test(line)
    ) {
      const candidate = cleanExtractedName(line, candidateNames);
      if (candidate.split(' ').length >= 1 && candidate.length >= 3) {
        return candidate;
      }
    }
  }

  return '';
}

/**
 * Phonetic normalization for cross-lingual English and Indic transliterations
 */
function phoneticNormalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\bvi\b|\bvee\b/g, 'v')
    .replace(/\bar\b|\baar\b/g, 'r')
    .replace(/\bes\b|\bess\b/g, 's')
    .replace(/\bem\b/g, 'm')
    .replace(/\ben\b/g, 'n')
    .replace(/\bkay\b|\bkaa\b/g, 'k')
    .replace(/sh/g, 's')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/vu\b/g, 'o')
    .replace(/ph/g, 'f')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compare target employee name with document name.
 * Supports cross-lingual matching (English HR name vs. Hindi/Tamil/Telugu/Kannada/Malayalam document name).
 * Ignores case, extra spaces, minor punctuation, initials and small spelling variations.
 */
function compareNameComponents(targetName, documentName, documentFullText = '') {
  if (!targetName || !targetName.trim()) {
    return { match: 'NOT MATCH', score: 0, reason: 'Target name missing' };
  }

  const normTarget = normalizeName(targetName);
  const normDoc = normalizeName(documentName);
  const transDoc = normalizeName(transliterateIndicToLatin(documentName));

  if (!normDoc && !transDoc) {
    if (documentFullText) {
      const normFull = normalizeName(documentFullText);
      const transFull = normalizeName(transliterateIndicToLatin(documentFullText));
      if (normFull.includes(normTarget) || transFull.includes(normTarget)) {
        return { match: 'MATCH', score: 90, details: 'Target name found in document text.' };
      }
    }
    return { match: 'NOT MATCH', score: 0, reason: 'Document name not readable.' };
  }

  // 1. Direct or Transliterated Exact Match
  if (normTarget === normDoc || normTarget === transDoc) {
    return { match: 'MATCH', score: 100, details: 'Exact match.' };
  }

  // 2. Phonetic normalized comparison (for cross-lingual names across Indian languages)
  const phoneTarget = phoneticNormalize(normTarget);
  const phoneDoc = phoneticNormalize(transDoc || normDoc);
  if (phoneTarget && phoneDoc) {
    if (phoneTarget === phoneDoc) {
      return { match: 'MATCH', score: 98, details: 'Phonetic cross-script match.' };
    }
    const phoneSim = stringSimilarity(phoneTarget, phoneDoc);
    if (phoneSim >= 0.80) {
      return {
        match: 'MATCH',
        score: Math.round(phoneSim * 100),
        details: `High phonetic similarity (${Math.round(phoneSim * 100)}%).`
      };
    }
  }

  // Compare against both normDoc and transDoc
  const candidateDocs = [normDoc, transDoc].filter(Boolean);

  for (const docStr of candidateDocs) {
    // 3. Token Breakdown
    const targetTokens = normTarget.split(' ').filter(Boolean);
    const docTokens = docStr.split(' ').filter(Boolean);

    const targetMainTokens = targetTokens.filter(t => t.length > 1);
    const docMainTokens = docTokens.filter(t => t.length > 1);

    // 4. Token set match (e.g. "Kumar Sharan" vs "Sharan Kumar")
    const targetSet = new Set(targetTokens);
    const docSet = new Set(docTokens);
    const isSubset = targetTokens.every(t => docSet.has(t));
    const isDocSubset = docTokens.every(t => targetSet.has(t));

    if (isSubset && isDocSubset) {
      return { match: 'MATCH', score: 98, details: 'All name tokens match.' };
    }

    // 5. Initials Handling:
    // If all main tokens match, and initials differ only by presence or position
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

    // Check shared main tokens
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

    // 6. String Similarity / Spelling Variations
    const fullSim = stringSimilarity(normTarget, docStr);
    if (fullSim >= 0.85) {
      return {
        match: 'MATCH',
        score: Math.round(fullSim * 100),
        details: `High name similarity (${Math.round(fullSim * 100)}%).`
      };
    }
  }

  // 7. Check full text containment
  if (documentFullText) {
    const normFull = normalizeName(documentFullText);
    const transFull = normalizeName(transliterateIndicToLatin(documentFullText));
    if (normFull.includes(normTarget) || transFull.includes(normTarget) ||
        (phoneTarget && phoneticNormalize(transFull).includes(phoneTarget))) {
      return { match: 'MATCH', score: 90, details: 'Target name found in document text.' };
    }
  }

  // 8. Partial match check (similarity 0.65 to 0.84 on transliterated or direct)
  const maxSim = Math.max(
    stringSimilarity(normTarget, normDoc),
    transDoc ? stringSimilarity(normTarget, transDoc) : 0,
    phoneTarget && phoneDoc ? stringSimilarity(phoneTarget, phoneDoc) : 0
  );

  if (maxSim >= 0.65) {
    return {
      match: 'PARTIAL MATCH',
      score: Math.round(maxSim * 100),
      details: `Partial name match (${Math.round(maxSim * 100)}%).`
    };
  }

  // 9. Clearly different person!
  return {
    match: 'NOT MATCH',
    score: Math.round(maxSim * 100),
    details: 'Name does not match.'
  };
}

/**
 * Extract 6-digit Indian pincode
 */
function extractPincode(str) {
  if (!str) return '';
  const normalized = normalizeIndicNumerals(str);
  const m = normalized.match(/\b([1-9][0-9]{5})\b/);
  return m ? m[1] : '';
}

/**
 * Extract house/door/flat number
 */
function extractHouseNumber(str) {
  if (!str) return '';
  const normalized = normalizeIndicNumerals(str);
  const m = normalized.match(/\b(?:no\.?|door|flat|plot|house|எண்|सं|నెం|ಸಂ|നം)?\s*([0-9]+[a-z]?[\/\-]?[0-9]*[a-z]?)\b/i);
  return m ? m[1].toUpperCase() : '';
}

/**
 * Standardize text for loose abbreviation & formatting matching
 */
function normalizeForComparison(str) {
  if (!str) return '';
  const normalized = normalizeIndicNumerals(str);
  return normalized
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
 * Supports cross-script phonetic matching (transliterated Indic text vs. English HR address).
 */
function compareAddressComponents(targetAddress, documentText, extractedAddress, options = {}) {
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

  const normalizedDocText = normalizeIndicNumerals(documentText);
  const normalizedExtracted = normalizeIndicNumerals(extractedAddress || '');

  const normTarget = normalizeForComparison(targetAddress);
  const normDoc = normalizeForComparison(normalizedDocText);
  const rawTargetLower = (targetAddress || '').toLowerCase();
  const rawDocLower = normalizedDocText.toLowerCase();

  // Transliterate Indic document text into phonetic Latin for cross-language matching
  const transliteratedDoc = transliterateIndicToLatin(normalizedDocText);
  const transliteratedExtracted = transliterateIndicToLatin(normalizedExtracted);
  const transDocLower = transliteratedDoc.toLowerCase();
  const normTransDoc = normalizeForComparison(transliteratedDoc);

  let totalScore = 0;

  // 1. PINCODE (25 pts)
  const targetPin = extractPincode(targetAddress);
  const docPin = extractPincode(normalizedExtracted || normalizedDocText);
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
    if (rawDocLower.includes(targetPin) || transDocLower.includes(targetPin)) {
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
    const cleanTransDoc = transDocLower.replace(/[\s\/\-]/g, '');

    if (cleanDoc.includes(cleanHouse) || cleanTransDoc.includes(cleanHouse) ||
        normDoc.includes(targetHouse.toLowerCase()) || normTransDoc.includes(targetHouse.toLowerCase())) {
      totalScore += 25;
      houseStatus = 'MATCH';
    } else {
      // Check if another explicit house number was detected
      const docHouse = extractHouseNumber(normalizedExtracted || transliteratedExtracted);
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
  const cleanTransSpaceless = transDocLower.replace(/\s+/g, '');
  const streetTokens = targetAddress
    .split(/[\s,./-]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 4 && !['india', 'tamil', 'nadu', 'tamilnadu', 'chennai', 'street', 'road'].includes(w));

  let matchedTokens = 0;
  for (const token of streetTokens) {
    const cleanToken = token.replace(/\s+/g, '');
    if (
      rawDocLower.includes(token) ||
      cleanDocSpaceless.includes(cleanToken) ||
      transDocLower.includes(token) ||
      cleanTransSpaceless.includes(cleanToken)
    ) {
      matchedTokens++;
    } else {
      // Fuzzy token check on transliterated text
      for (const dWord of transDocLower.split(/\s+/)) {
        if (dWord.length >= 4 && stringSimilarity(dWord, token) >= 0.80) {
          matchedTokens++;
          break;
        }
      }
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
  }  // 4. AREA / LOCALITY (15 pts)
  let areaStatus = 'NOT MATCH';
  const areaKeywords = [
    // Chennai & Tamil Nadu localities
    'egmore', 'santhosh nagar', 'dr santhosh nagar', 'doctor santhosh nagar', 'vinayagapuram',
    'surapet', 'velmurugan', 'anna nagar', 't nagar', 'velachery', 'ambattur', 'tambaram',
    'guindy', 'porur', 'madhavaram', 'redhills', 'vadapalani', 'perambur', 'mylapore',
    'alwarpet', 'adyar', 'kolathur', 'royapettah', 'chromepet', 'pallavaram', 'saidapet',
    'sholinganallur', 'thiruvanmiyur', 'besant nagar', 'kilpauk', 'teynampet', 'mandaveli',
    'puzhal', 'villivakkam', 'avadi', 'nungambakkam', 'kodambakkam', 'triplicane', 'chepauk',
    'chintadripet', 'george town', 'royapuram', 'tondiarpet', 'washermanpet',
    // Bangalore localities
    'marathahalli', 'whitefield', 'koramangala', 'indiranagar', 'jayanagar', 'jp nagar',
    'hsr layout', 'electronic city', 'bellandur', 'hebbal', 'banashankari', 'rajajinagar',
    'malleshwaram', 'btm layout',
    // Hyderabad localities
    'hitec city', 'gachibowli', 'madhapur', 'banjara hills', 'jubilee hills', 'kondapur',
    'kukatpally', 'ameerpet', 'begumpet', 'secunderabad',
    // Mumbai localities
    'andheri', 'bandra', 'borivali', 'dadar', 'juhu', 'malad', 'goregaon', 'thane', 'navi mumbai',
    'kurla', 'chembur', 'powai',
    // Delhi localities
    'rohini', 'dwarka', 'connaught place', 'saket', 'lajpat nagar', 'janakpuri', 'karol bagh',
    'pitampura', 'vasant kunj', 'hauz khas'
  ];

  let areaMatched = false;

  // a) Check explicitly registered areaKeywords
  for (const a of areaKeywords) {
    if (
      rawTargetLower.includes(a) &&
      (rawDocLower.includes(a) || cleanDocSpaceless.includes(a.replace(/\s+/g, '')) ||
       transDocLower.includes(a) || cleanTransSpaceless.includes(a.replace(/\s+/g, '')))
    ) {
      areaMatched = true;
      break;
    }
  }

  // b) Check explicit employee.hr_area if provided
  if (!areaMatched) {
    const candidateAreaStr = (options.targetArea || options.employee?.hr_area || '').toLowerCase().trim();
    if (candidateAreaStr && candidateAreaStr.length >= 3) {
      if (
        rawDocLower.includes(candidateAreaStr) ||
        cleanDocSpaceless.includes(candidateAreaStr.replace(/\s+/g, '')) ||
        transDocLower.includes(candidateAreaStr) ||
        cleanTransSpaceless.includes(candidateAreaStr.replace(/\s+/g, ''))
      ) {
        areaMatched = true;
      }
    }
  }

  // c) Dynamic token matching from target address
  // Extract tokens that represent localities/areas (length >= 4, excluding city, state, pin, street stop words)
  if (!areaMatched) {
    const nonAreaWords = new Set([
      'india', 'tamil', 'nadu', 'tamilnadu', 'chennai', 'street', 'road', 'salai',
      'lane', 'cross', 'main', 'door', 'flat', 'plot', 'house', 'nagar', 'near',
      'opp', 'opposite', 'behind', 'beside', 'floor', 'block', 'phase'
    ]);
    const areaTokens = targetAddress
      .split(/[\s,./-]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length >= 4 && !nonAreaWords.has(w) && !/^\d+$/.test(w));

    for (const token of areaTokens) {
      if (
        rawDocLower.includes(token) ||
        cleanDocSpaceless.includes(token) ||
        transDocLower.includes(token) ||
        cleanTransSpaceless.includes(token)
      ) {
        areaMatched = true;
        break;
      }
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

  // 5. CITY (10 pts) - Multilingual dictionary across English, Hindi, Tamil, Telugu, Kannada, Malayalam
  let cityStatus = 'NOT MATCH';
  const cityMultilingual = [
    { en: 'chennai', aliases: ['chennai', 'madras', 'சென்னை', 'चेन्नई', 'మద్రాస్', 'చెన్నై', 'ಚೆನ್ನೈ', 'ചെന്നൈ'] },
    { en: 'bengaluru', aliases: ['bengaluru', 'bangalore', 'बेंगलुरु', 'ಬೆಂಗಳೂರು', 'బెంగళూరు', 'ബംഗളൂരു', 'பெங்களூரு'] },
    { en: 'hyderabad', aliases: ['hyderabad', 'हैदराबाद', 'హైదరాబాద్', 'ಹೈದರಾಬಾದ್', 'ഹൈദരാബാദ്', 'ஹைதராபாத்'] },
    { en: 'mumbai', aliases: ['mumbai', 'bombay', 'मुंबई', 'ముంబై', 'ಮುಂಬೈ', 'മുംബൈ', 'மும்பை'] },
    { en: 'delhi', aliases: ['delhi', 'new delhi', 'दिल्ली', 'नई दिल्ली', 'దిల్లీ', 'ದೆಹಲಿ', 'ഡൽഹി', 'தில்லி'] },
    { en: 'coimbatore', aliases: ['coimbatore', 'kovai', 'கோயம்புத்தூர்', 'கோவை', 'कोयंबटूर'] },
    { en: 'madurai', aliases: ['madurai', 'மதுரை', 'मदुरै'] },
    { en: 'trichy', aliases: ['trichy', 'tiruchirappalli', 'திருச்சி', 'तिरुचिरापल्ली'] },
    { en: 'salem', aliases: ['salem', 'சேலம்', 'सेलम'] },
    { en: 'kochi', aliases: ['kochi', 'cochin', 'കൊച്ചി', 'कोच्चि'] },
    { en: 'thiruvananthapuram', aliases: ['thiruvananthapuram', 'trivandrum', 'തിരുവനന്തപുരം'] },
    { en: 'visakhapatnam', aliases: ['visakhapatnam', 'vizag', 'విశాఖపట్నం'] },
    { en: 'vijayawada', aliases: ['vijayawada', 'విజయవాడ'] },
    { en: 'mysuru', aliases: ['mysuru', 'mysore', 'ಮೈಸೂರು'] },
    { en: 'pune', aliases: ['pune', 'पुणे'] },
    { en: 'kolkata', aliases: ['kolkata', 'calcutta', 'कोलकाता'] }
  ];

  for (const cityObj of cityMultilingual) {
    const isTargetCity = cityObj.aliases.some(alias => rawTargetLower.includes(alias));
    if (isTargetCity) {
      const isDocCity = cityObj.aliases.some(alias =>
        rawDocLower.includes(alias) || cleanDocSpaceless.includes(alias.replace(/\s+/g, '')) ||
        transDocLower.includes(alias) || cleanTransSpaceless.includes(alias.replace(/\s+/g, ''))
      );
      if (isDocCity) {
        totalScore += 10;
        cityStatus = 'MATCH';
        break;
      }
    }
  }

  // 6. STATE (5 pts) - Multilingual dictionary with intelligent city/pincode inference
  let stateStatus = 'NOT MATCH';
  const stateMultilingual = [
    { en: 'tamil nadu', aliases: ['tamil nadu', 'tamilnadu', 'தமிழ்நாடு', 'तमिलनाडु', 'తమిళనాడు', 'ತಮಿಳುನಾಡು', 'തമിഴ്നാട്'] },
    { en: 'karnataka', aliases: ['karnataka', 'ಕರ್ನಾಟಕ', 'कर्नाटक', 'కర్ణాటక', 'കർണാടക', 'கர்நாடகா'] },
    { en: 'kerala', aliases: ['kerala', 'കേരളം', 'கேரளா', 'केरल', 'కేరళ', 'ಕೇರಳ'] },
    { en: 'andhra pradesh', aliases: ['andhra pradesh', 'andhra', 'ఆంధ్ర ప్రదేశ్', 'आंध्र प्रदेश', 'ಆಂಧ್ರ ಪ್ರದೇಶ', 'ആന്ധ്രാപ്രദേശ്'] },
    { en: 'telangana', aliases: ['telangana', 'తెలంగాణ', 'तेलंगाना', 'ತೆಲಂಗಾಣ', 'തെലങ്കാന'] },
    { en: 'maharashtra', aliases: ['maharashtra', 'महाराष्ट्र', 'మహారాష్ట్ర', 'ಮಹಾರಾಷ್ಟ್ರ', 'മഹാരാഷ്ട്ര'] },
    { en: 'uttar pradesh', aliases: ['uttar pradesh', 'उत्तर प्रदेश', 'యు.పి'] },
    { en: 'delhi', aliases: ['delhi', 'दिल्ली', 'దిల్లీ', 'ದೆಹಲಿ'] },
    { en: 'west bengal', aliases: ['west bengal', 'पश्चिम बंगाल', 'పశ్చిమ బెంగాల్', 'পশ্চিমবঙ্গ'] }
  ];

  // Determine target state:
  // a) Explicitly in target address text
  let targetStateObj = stateMultilingual.find(st => st.aliases.some(alias => rawTargetLower.includes(alias)));

  // b) Or from employee.hr_state / options.targetState
  if (!targetStateObj) {
    const candidateStateStr = (options.targetState || options.employee?.hr_state || options.employee?.state || '').toLowerCase();
    if (candidateStateStr) {
      targetStateObj = stateMultilingual.find(st => st.aliases.some(alias => candidateStateStr.includes(alias)));
    }
  }

  // c) Or inferred from target city (Chennai -> Tamil Nadu, Bengaluru -> Karnataka, etc.)
  if (!targetStateObj) {
    const candidateCityStr = (options.targetCity || options.employee?.hr_city || rawTargetLower).toLowerCase();
    if (/\b(?:chennai|madras|coimbatore|madurai|trichy|tiruchirappalli|salem|vellore|tirunelveli|erode|kanchipuram|thanjavur)\b/i.test(candidateCityStr)) {
      targetStateObj = stateMultilingual.find(st => st.en === 'tamil nadu');
    } else if (/\b(?:bengaluru|bangalore|mysuru|mysore|hubli|mangalore|belgaum|shimoga)\b/i.test(candidateCityStr)) {
      targetStateObj = stateMultilingual.find(st => st.en === 'karnataka');
    } else if (/\b(?:hyderabad|secunderabad|warangal)\b/i.test(candidateCityStr)) {
      targetStateObj = stateMultilingual.find(st => st.en === 'telangana');
    } else if (/\b(?:visakhapatnam|vizag|vijayawada|guntur|tirupati|kakinada|nellore)\b/i.test(candidateCityStr)) {
      targetStateObj = stateMultilingual.find(st => st.en === 'andhra pradesh');
    } else if (/\b(?:kochi|cochin|thiruvananthapuram|trivandrum|kozhikode|calicut|thrissur)\b/i.test(candidateCityStr)) {
      targetStateObj = stateMultilingual.find(st => st.en === 'kerala');
    } else if (/\b(?:mumbai|bombay|pune|nagpur|nashik|thane|aurangabad)\b/i.test(candidateCityStr)) {
      targetStateObj = stateMultilingual.find(st => st.en === 'maharashtra');
    } else if (/\b(?:delhi|new delhi)\b/i.test(candidateCityStr)) {
      targetStateObj = stateMultilingual.find(st => st.en === 'delhi');
    } else if (/\b(?:kolkata|calcutta|howrah)\b/i.test(candidateCityStr)) {
      targetStateObj = stateMultilingual.find(st => st.en === 'west bengal');
    } else if (/\b(?:lucknow|kanpur|noida|varanasi|agra|prayagraj|ghaziabad)\b/i.test(candidateCityStr)) {
      targetStateObj = stateMultilingual.find(st => st.en === 'uttar pradesh');
    }
  }

  // d) Or inferred from 6-digit pincode range
  if (!targetStateObj && targetPin) {
    const pinNum = parseInt(targetPin, 10);
    if (pinNum >= 600000 && pinNum <= 649999) targetStateObj = stateMultilingual.find(st => st.en === 'tamil nadu');
    else if (pinNum >= 560000 && pinNum <= 599999) targetStateObj = stateMultilingual.find(st => st.en === 'karnataka');
    else if (pinNum >= 670000 && pinNum <= 699999) targetStateObj = stateMultilingual.find(st => st.en === 'kerala');
    else if (pinNum >= 500000 && pinNum <= 509999) targetStateObj = stateMultilingual.find(st => st.en === 'telangana');
    else if (pinNum >= 510000 && pinNum <= 539999) targetStateObj = stateMultilingual.find(st => st.en === 'andhra pradesh');
    else if (pinNum >= 400000 && pinNum <= 449999) targetStateObj = stateMultilingual.find(st => st.en === 'maharashtra');
    else if (pinNum >= 110000 && pinNum <= 110099) targetStateObj = stateMultilingual.find(st => st.en === 'delhi');
    else if (pinNum >= 200000 && pinNum <= 289999) targetStateObj = stateMultilingual.find(st => st.en === 'uttar pradesh');
    else if (pinNum >= 700000 && pinNum <= 749999) targetStateObj = stateMultilingual.find(st => st.en === 'west bengal');
  }

  if (targetStateObj) {
    const isDocState = targetStateObj.aliases.some(alias =>
      rawDocLower.includes(alias) || cleanDocSpaceless.includes(alias.replace(/\s+/g, '')) ||
      transDocLower.includes(alias) || cleanTransSpaceless.includes(alias.replace(/\s+/g, ''))
    );
    if (isDocState) {
      totalScore += 5;
      stateStatus = 'MATCH';
    } else {
      // Check if document mentions country India and city/pincode matches
      if (rawDocLower.includes('india') && (cityStatus === 'MATCH' || pincodeStatus === 'MATCH')) {
        totalScore += 5;
        stateStatus = 'MATCH';
      }
    }
  } else {
    // If no state could be inferred from target or document, neutral match
    totalScore += 5;
    stateStatus = 'MATCH';
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
 * Supports all 6 Indian languages (English, Hindi, Tamil, Telugu, Kannada, Malayalam)
 * Detects document language, extracts name & address, compares with HR records, and routes
 * unclear / failed OCR to REVIEW REQUIRED.
 */
const documentMatchCache = new Map();

/**
 * Perform comprehensive document address extraction, OCR language detection,
 * and multi-component address match scoring.
 *
 * @param {Object} employee - Employee database record
 * @param {Object} progress - Verification progress record
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh]
 * @param {boolean} [options.fastOnly]
 * @returns {Promise<Object>} Complete matching report
 */
async function performDocumentAddressMatch(employee, progress, options = {}) {
  if (!progress || !progress.document_path) {
    return {
      success: false,
      documentAvailable: false,
      extractedAddress: null,
      hrAddressMatch: 'NOT MATCH',
      employeeConfirmedAddressMatch: 'NOT MATCH',
      overallResult: 'REVIEW REQUIRED',
      statusMessage: 'NO DOCUMENT ATTACHED',
      requiresManualReview: true,
      details: 'No address proof document has been uploaded for this case.',
      languageDetection: null,
      detectedLanguages: [],
      isMixedLanguage: false,
      languageSummary: 'Unknown'
    };
  }

  const cacheKey = `${employee?.employee_id || ''}:${progress?.document_path || ''}:${progress?.document_back_path || ''}`;
  if (!options.forceRefresh && documentMatchCache.has(cacheKey)) {
    return documentMatchCache.get(cacheKey);
  }

  // If already persisted in verification_progress and not forcing refresh, return it
  if (!options.forceRefresh && progress?.document_address_match) {
    try {
      const parsed = typeof progress.document_address_match === 'string'
        ? JSON.parse(progress.document_address_match)
        : progress.document_address_match;
      if (parsed && typeof parsed === 'object') {
        documentMatchCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (_) {}
  }

  // If fastOnly requested and not cached, do not run heavy OCR synchronously on page load
  if (options.fastOnly) {
    return null;
  }

  const saveAndReturn = (matchResult) => {
    documentMatchCache.set(cacheKey, matchResult);
    if (employee?.employee_id) {
      try {
        const { query } = require('../db/database');
        if (query && query.run) {
          query.run(
            'UPDATE verification_progress SET document_address_match = ? WHERE employee_id = ?',
            [JSON.stringify(matchResult), employee.employee_id]
          ).catch(() => {});
        }
      } catch (_) {}
    }
    return matchResult;
  };

  const docPath = progress.document_path;
  const backDocPath = progress.document_back_path;

  // OCR runs on the perspective-corrected, upright enhanced images per requirement
  const frontScanPath = (progress.document_enhanced_path && fs.existsSync(progress.document_enhanced_path))
    ? progress.document_enhanced_path
    : docPath;

  const backScanPath = (progress.document_back_enhanced_path && fs.existsSync(progress.document_back_enhanced_path))
    ? progress.document_back_enhanced_path
    : backDocPath;

  let rawDocText = '';
  if (frontScanPath && fs.existsSync(frontScanPath)) {
    try {
      rawDocText = await extractTextFromDocument(frontScanPath);
    } catch (fErr) {
      console.warn('Front document OCR error:', fErr.message);
    }
  }

  let backDocText = '';
  if (backScanPath && fs.existsSync(backScanPath)) {
    try {
      backDocText = await extractTextFromDocument(backScanPath);
    } catch (bErr) {
      console.warn('Back document OCR error:', bErr.message);
    }
  }

  const hrAddress = employee?.hr_current_address || employee?.address || '';
  const empConfirmedAddress = progress?.submitted_address || hrAddress;
  const hrName = employee?.employee_name || employee?.name || '';
  const empConfirmedName = progress?.submitted_name || hrName;

  const combinedDocText = [rawDocText, backDocText].filter(Boolean).join('\n');
  const langDetection = detectDocumentLanguage(combinedDocText);

  const isTargetLatin = !/[\u0900-\u0D7F]/.test(hrAddress || empConfirmedAddress || '');
  const extractedAddress = extractAddressFromText(combinedDocText, isTargetLatin) ||
                           extractAddressFromText(backDocText, isTargetLatin) ||
                           extractAddressFromText(rawDocText, isTargetLatin);
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

  // If OCR failed or address could not be read clearly, route for HR/BGV review
  if (!addressCouldBeRead) {
    return saveAndReturn({
      success: true,
      documentAvailable: true,
      documentType: progress.document_type || 'Address Proof',
      fileName: progress.document_original_name || (docPath ? path.basename(docPath) : 'Front Document'),
      backFileName: progress.document_back_original_name || (backDocPath ? path.basename(backDocPath) : null),
      extractedAddress: 'Address text could not be clearly extracted from document.',
      extractedName: extractedName || 'Name text could not be clearly extracted.',
      languageDetection: langDetection,
      detectedLanguages: langDetection.languages,
      isMixedLanguage: langDetection.isMixedLanguage,
      languageSummary: langDetection.languageSummary,
      hrNameMatch: hrNameComparison.match,
      hrNameScore: hrNameComparison.score,
      employeeConfirmedNameMatch: empNameComparison.match,
      employeeNameScore: empNameComparison.score,
      nameMatchStatus: nameOverallStatus,
      hrAddressMatch: 'NOT MATCH',
      employeeConfirmedAddressMatch: 'NOT MATCH',
      overallResult: 'REVIEW REQUIRED',
      statusMessage: 'ADDRESS COULD NOT BE READ – REVIEW REQUIRED',
      requiresManualReview: true,
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
    });
  }

  const hrComparison = compareAddressComponents(hrAddress, combinedDocText, extractedAddress, {
    employee,
    targetCity: employee?.hr_city,
    targetState: employee?.hr_state,
    targetPin: employee?.hr_pincode,
    targetArea: employee?.hr_area
  });
  const empComparison = compareAddressComponents(empConfirmedAddress, combinedDocText, extractedAddress, {
    employee,
    targetCity: employee?.hr_city,
    targetState: employee?.hr_state,
    targetPin: employee?.hr_pincode,
    targetArea: employee?.hr_area
  });

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
  // - If one is partial or needs manual verification: REVIEW REQUIRED
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

  const extractedPincode = extractPincode(combinedDocText) || extractPincode(extractedAddress) || '';
  const unreadableFields = [];
  if (!extractedName || extractedName.includes('could not be')) unreadableFields.push('Employee Name');
  if (!extractedAddress || extractedAddress.includes('could not be') || extractedAddress.length < 8) unreadableFields.push('Residential Address');
  if (!extractedPincode) unreadableFields.push('PIN Code');

  let decision = 'HR/BGV REVIEW REQUIRED';
  if (overallResult === 'MATCHED') {
    decision = 'ACCEPTED';
  } else if (overallResult === 'NOT MATCHED' && !addressCouldBeRead) {
    decision = 'REJECTED';
  } else {
    decision = 'HR/BGV REVIEW REQUIRED';
  }

  const formatUrl = (p) => p ? `/uploads/${path.basename(p)}` : null;

  return saveAndReturn({
    success: true,
    documentAvailable: true,
    decision,
    documentType: progress.document_type || 'Address Proof',
    fileName: progress.document_original_name || (docPath ? path.basename(docPath) : 'Front Document'),
    backFileName: progress.document_back_original_name || (backDocPath ? path.basename(backDocPath) : null),
    extractedAddress: extractedAddress || rawDocText.substring(0, 160).trim(),
    extractedName: extractedName || 'Name text could not be clearly extracted.',
    extractedPincode,
    unreadableFields,
    originalFrontUrl: formatUrl(docPath),
    enhancedFrontUrl: formatUrl(progress.document_enhanced_path),
    originalBackUrl: formatUrl(backDocPath),
    enhancedBackUrl: formatUrl(progress.document_back_enhanced_path),
    languageDetection: langDetection,
    detectedLanguages: langDetection.languages,
    isMixedLanguage: langDetection.isMixedLanguage,
    languageSummary: langDetection.languageSummary,
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
    requiresManualReview: overallResult === 'REVIEW REQUIRED' || decision === 'HR/BGV REVIEW REQUIRED',
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
  });
}

module.exports = {
  performDocumentAddressMatch,
  extractTextFromDocument,
  extractAddressFromText,
  extractNameFromText,
  compareNameComponents,
  compareAddressComponents,
  extractTextFromPdfBuffer,
  extractPincode,
  extractHouseNumber
};
