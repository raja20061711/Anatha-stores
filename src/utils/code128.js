/**
 * Standard Code 128 (Subset B) barcode patterns
 * Encodes printable ASCII characters 32 (space) to 126 (~).
 */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (104=Start B, 106=Stop)
];

const START_B = 104;
const STOP = 106;

export function encodeCode128B(text) {
  if (!text) return null;
  const str = String(text);
  const values = [];

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      values.push(code - 32);
    } else {
      values.push(0); // fallback space
    }
  }

  // Calculate checksum: (START_B + sum(pos * val)) % 103
  let checksum = START_B;
  for (let i = 0; i < values.length; i++) {
    checksum += (i + 1) * values[i];
  }
  checksum = checksum % 103;

  // Build string of bar widths
  let patternStr = PATTERNS[START_B];
  for (const v of values) {
    patternStr += PATTERNS[v];
  }
  patternStr += PATTERNS[checksum];
  patternStr += PATTERNS[STOP];

  return patternStr;
}
