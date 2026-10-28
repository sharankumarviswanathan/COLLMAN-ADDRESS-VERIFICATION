const path = require('path');
const fs = require('fs');
const { createWorker } = require('tesseract.js');

/**
 * All supported Indian languages + English for Address Proof OCR
 * eng: English (Latin)
 * hin: Hindi (Devanagari)
 * tam: Tamil
 * tel: Telugu
 * kan: Kannada
 * mal: Malayalam
 */
const SUPPORTED_OCR_LANGUAGES = ['eng', 'hin', 'tam', 'tel', 'kan', 'mal'];

let sharedIndianWorker = null;
let workerInitPromise = null;

/**
 * Resolve directory path where traineddata files are stored.
 * Traineddata files are placed in the project root directory.
 */
function getTessdataPath() {
  const rootDir = path.resolve(__dirname, '../../');
  if (fs.existsSync(path.join(rootDir, 'eng.traineddata'))) {
    return rootDir;
  }
  if (fs.existsSync(path.join(process.cwd(), 'eng.traineddata'))) {
    return process.cwd();
  }
  return rootDir;
}

/**
 * Get or initialize shared Tesseract worker supporting all 6 Indian languages
 */
async function getIndianLanguageWorker() {
  if (sharedIndianWorker) return sharedIndianWorker;
  if (!workerInitPromise) {
    workerInitPromise = (async () => {
      const tessdataPath = getTessdataPath();
      try {
        console.log(`[OCR] Initializing multi-language Tesseract worker [${SUPPORTED_OCR_LANGUAGES.join(', ')}]...`);
        const worker = await createWorker(SUPPORTED_OCR_LANGUAGES, undefined, {
          langPath: tessdataPath
        });
        sharedIndianWorker = worker;
        console.log('[OCR] Successfully initialized 6-language Indian OCR worker.');
        return worker;
      } catch (err) {
        console.warn('[OCR] Failed to initialize all 6 languages, falling back to eng+tam+hin:', err.message);
        try {
          const fallbackWorker = await createWorker(['eng', 'tam', 'hin'], undefined, {
            langPath: tessdataPath
          });
          sharedIndianWorker = fallbackWorker;
          return fallbackWorker;
        } catch (err2) {
          console.warn('[OCR] Failed fallback to eng+tam+hin, falling back to eng+tam:', err2.message);
          try {
            const fallback2 = await createWorker(['eng', 'tam'], undefined, {
              langPath: tessdataPath
            });
            sharedIndianWorker = fallback2;
            return fallback2;
          } catch (err3) {
            console.warn('[OCR] Final fallback to eng:', err3.message);
            try {
              const engWorker = await createWorker('eng', undefined, {
                langPath: tessdataPath
              });
              sharedIndianWorker = engWorker;
              return engWorker;
            } catch (fatalErr) {
              console.error('[OCR] Fatal: Could not initialize any Tesseract worker:', fatalErr.message);
              sharedIndianWorker = null;
              workerInitPromise = null;
              return null;
            }
          }
        }
      }
    })();
  }
  return workerInitPromise;
}

/**
 * Backward compatibility alias for existing callers
 */
async function getDualLanguageWorker() {
  return getIndianLanguageWorker();
}

/**
 * Convert Indic digits (Devanagari, Tamil, Telugu, Kannada, Malayalam) to ASCII 0-9
 * Also maps regional phonetic letters used for house sub-divisions (e.g. 13/ए -> 13/A)
 */
function normalizeIndicNumerals(str) {
  if (!str) return '';
  return str
    .replace(/[\u0966-\u096F]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 48))
    .replace(/[\u0BE6-\u0BEF]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0BE6 + 48))
    .replace(/[\u0C66-\u0C6F]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0C66 + 48))
    .replace(/[\u0CE6-\u0CEF]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0CE6 + 48))
    .replace(/[\u0D66-\u0D6F]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0D66 + 48))
    // House number regional letters (13/ए, 13/ஏ, 13/ఎ, 13/ಎ, 13/എ -> 13/A)
    .replace(/(\d+[\/\-])[एஏఎಎഎ]/g, (m, p) => p + 'A')
    .replace(/(\d+[\/\-])(?:बी|பி|బి|ಬಿ|ബി)/g, (m, p) => p + 'B')
    .replace(/(\d+[\/\-])(?:सी|சி|సి|ಸಿ|സി)/g, (m, p) => p + 'C')
    .replace(/(\d+[\/\-])(?:डी|டி|డి|ಡಿ|ഡി)/g, (m, p) => p + 'D');
}

/**
 * Script Unicode ranges
 */
const SCRIPT_RANGES = {
  English: /[A-Za-z]/g,
  Hindi: /[\u0900-\u097F]/g,
  Tamil: /[\u0B80-\u0BFF]/g,
  Telugu: /[\u0C00-\u0C7F]/g,
  Kannada: /[\u0C80-\u0CFF]/g,
  Malayalam: /[\u0D00-\u0D7F]/g
};

/**
 * Automatically detect document language(s) and whether document is mixed-language
 */
function detectDocumentLanguage(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    return {
      primaryLanguage: 'Unknown',
      languages: [],
      isMixedLanguage: false,
      languageSummary: 'Unknown',
      scriptCounts: {}
    };
  }

  const scriptCounts = {};
  for (const [lang, regex] of Object.entries(SCRIPT_RANGES)) {
    const matches = rawText.match(regex);
    scriptCounts[lang] = matches ? matches.length : 0;
  }

  // Count active languages (threshold: at least 4 characters or 5% of recognized characters)
  const totalLetters = Object.values(scriptCounts).reduce((a, b) => a + b, 0);
  const detected = [];

  for (const [lang, count] of Object.entries(scriptCounts)) {
    if (count >= 5 || (totalLetters > 20 && (count / totalLetters) >= 0.08)) {
      detected.push({ lang, count });
    }
  }

  detected.sort((a, b) => b.count - a.count);

  if (detected.length === 0) {
    return {
      primaryLanguage: 'English',
      languages: ['English'],
      isMixedLanguage: false,
      languageSummary: 'English',
      scriptCounts
    };
  }

  const primary = detected[0].lang;
  const langs = detected.map(d => d.lang);
  const isMixed = detected.length > 1;

  let summary = primary;
  if (isMixed) {
    if (langs.includes('English') && langs.length === 2) {
      const other = langs.find(l => l !== 'English');
      summary = `English & ${other} (Bilingual)`;
    } else {
      summary = `${langs.join(' + ')} (Multilingual)`;
    }
  }

  return {
    primaryLanguage: primary,
    languages: langs,
    isMixedLanguage: isMixed,
    languageSummary: summary,
    scriptCounts
  };
}

/**
 * Indic Consonants mapping across 5 Indic scripts
 */
const INDIC_CONSONANTS = {
  // Devanagari (Hindi)
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',

  // Tamil
  'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'ny', 'ட': 't', 'ண': 'n', 'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm',
  'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
  'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h',

  // Telugu
  'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'ng', 'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny',
  'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n', 'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
  'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm', 'య': 'y', 'ర': 'r', 'ల': 'l', 'వ': 'v',
  'శ': 'sh', 'ష': 'sh', 'స': 's', 'హ': 'h', 'ళ': 'l',

  // Kannada
  'ಕ': 'k', 'ಖ': 'kh', 'ಗ': 'g', 'ಘ': 'gh', 'ಙ': 'ng', 'ಚ': 'ch', 'ಛ': 'chh', 'ಜ': 'j', 'ಝ': 'jh', 'ಞ': 'ny',
  'ಟ': 't', 'ಠ': 'th', 'ಡ': 'd', 'ಢ': 'dh', 'ಣ': 'n', 'ತ': 't', 'ಥ': 'th', 'ದ': 'd', 'ಧ': 'dh', 'ನ': 'n',
  'ಪ': 'p', 'ಫ': 'ph', 'ಬ': 'b', 'ಭ': 'bh', 'ಮ': 'm', 'ಯ': 'y', 'ರ': 'r', 'ಲ': 'l', 'ವ': 'v',
  'ಶ': 'sh', 'ಷ': 'sh', 'ಸ': 's', 'ಹ': 'h', 'ಳ': 'l',

  // Malayalam
  'ക': 'k', 'ഖ': 'kh', 'ഗ': 'g', 'ഘ': 'gh', 'ങ': 'ng', 'ച': 'ch', 'ഛ': 'chh', 'ജ': 'j', 'ഝ': 'jh', 'ഞ': 'ny',
  'ട': 't', 'ഠ': 'th', 'ഡ': 'd', 'ഢ': 'dh', 'ണ': 'n', 'ത': 'th', 'ഥ': 'th', 'ദ': 'd', 'ധ': 'dh', 'ന': 'n',
  'പ': 'p', 'ഫ': 'ph', 'ബ': 'b', 'ഭ': 'bh', 'മ': 'm', 'യ': 'y', 'ര': 'r', 'ല': 'l', 'വ': 'v',
  'ശ': 'sh', 'ഷ': 'sh', 'സ': 's', 'ഹ': 'h', 'ള': 'l', 'ഴ': 'zh', 'റ': 'r',
  'ൺ': 'n', 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'l', 'ൿ': 'k'
};

/**
 * Independent Vowels & Matras
 */
const INDIC_VOWELS = {
  // Independent vowels
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo', 'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oa', 'ஔ': 'au',
  'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo', 'ఋ': 'ri', 'ఎ': 'e', 'ఏ': 'ae', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'oo', 'ఔ': 'au',
  'ಅ': 'a', 'ಆ': 'aa', 'ಇ': 'i', 'ಈ': 'ee', 'ಉ': 'u', 'ಊ': 'oo', 'ಋ': 'ri', 'ಎ': 'e', 'ಏ': 'ae', 'ಐ': 'ai', 'ಒ': 'o', 'ಓ': 'oo', 'ಔ': 'au',
  'അ': 'a', 'ആ': 'aa', 'ഇ': 'i', 'ഈ': 'ee', 'ഉ': 'u', 'ഊ': 'oo', 'ഋ': 'ri', 'എ': 'e', 'ഏ': 'ae', 'ഐ': 'ai', 'ഒ': 'o', 'ഓ': 'oo', 'ഔ': 'au',

  // Matras (dependent vowel signs)
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ா': 'a', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo', 'ெ': 'e', 'ே': 'ae', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oa', 'ௌ': 'au',
  'ా': 'a', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo', 'ృ': 'ri', 'ె': 'e', 'ే': 'ae', 'ై': 'ai', 'ొ': 'o', 'ో': 'oo', 'ౌ': 'au',
  'ಾ': 'a', 'ಿ': 'i', 'ೀ': 'ee', 'ು': 'u', 'ೂ': 'oo', 'ೃ': 'ri', 'ೆ': 'e', 'ೇ': 'ae', 'ೈ': 'ai', 'ೊ': 'o', 'ೋ': 'oo', 'ೌ': 'au',
  'ാ': 'a', 'ി': 'i', 'ീ': 'ee', 'ു': 'u', 'ൂ': 'oo', 'ൃ': 'ri', 'െ': 'e', 'േ': 'ae', 'ൈ': 'ai', 'ൊ': 'o', 'ോ': 'oo', 'ൌ': 'au',

  // Anusvara & Visarga
  'ं': 'n', 'ः': 'h', 'ం': 'n', 'ಂ': 'n', 'ം': 'n'
};

const INDIC_MATRAS = new Set([
  'ा','ि','ी','ु','ू','ृ','े','ै','ो','ौ',
  'ா','ி','ீ','ு','ூ','ெ','ே','ை','ொ','ோ','ௌ',
  'ా','ి','ీ','ు','ూ','ృ','ె','ే','ై','ొ','ో','ౌ',
  'ಾ','ಿ','ೀ','ು','ೂ','ೃ','ೆ','ೇ','ೈ','ೊ','ೋ','ೌ',
  'ാ','ി','ീ','ു','ൂ','ൃ','െ','േ','ൈ','ൊ','ോ','ൌ'
]);

const INDIC_VIRAMAS = new Set(['्', '்', '్', '್', '്']);

/**
 * Transliterate Indic characters into phonetic Latin string.
 * Accurately models the Indic Abugida phonology (inherent vowel 'a',
 * virama cancellation, and matra attachment).
 */
function transliterateIndicToLatin(str) {
  if (!str) return '';
  let out = '';
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const ch = str[i];
    const next = i + 1 < len ? str[i + 1] : '';

    if (INDIC_CONSONANTS[ch] !== undefined) {
      out += INDIC_CONSONANTS[ch];
      if (INDIC_VIRAMAS.has(next)) {
        // Silenced virama
        i++;
      } else if (INDIC_MATRAS.has(next)) {
        // Matra replaces inherent 'a'
        out += INDIC_VOWELS[next] || '';
        i++;
      } else {
        // Inherent short 'a'
        out += 'a';
      }
    } else if (INDIC_VOWELS[ch] !== undefined) {
      out += INDIC_VOWELS[ch];
    } else {
      out += ch;
    }
  }

  // Normalize phonetic artifacts (e.g. word-final 'a' softening)
  return out
    .replace(/\b([a-z]{3,})a\b/gi, '$1')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/oa/g, 'o')
    .replace(/ae/g, 'e')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Perform OCR on an image buffer or file using the Indian language worker
 */
async function recognizeImageBuffer(imageBuffer) {
  if (!imageBuffer) return '';
  const worker = await getIndianLanguageWorker();
  if (!worker) return '';
  const ret = await worker.recognize(imageBuffer);
  return ret?.data?.text || '';
}

module.exports = {
  SUPPORTED_OCR_LANGUAGES,
  getIndianLanguageWorker,
  getDualLanguageWorker,
  normalizeIndicNumerals,
  detectDocumentLanguage,
  transliterateIndicToLatin,
  recognizeImageBuffer,
  SCRIPT_RANGES
};
