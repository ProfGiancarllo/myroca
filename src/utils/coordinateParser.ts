/**
 * Utility for parsing and validating geographic coordinates in various formats:
 * - Decimal degrees with dots or commas (e.g., -17.7924 or -17,7924)
 * - Degrees, Minutes and Seconds (DMS) e.g., 17°47'32.6"S 50°55'09.1"W or 17 47 32 S
 * - Degrees Decimal Minutes (DDM) e.g., 17° 47.543' S
 * - Missing negative detection for Brazilian territory
 */

export interface ParsedCoordinate {
  lat: number;
  lng: number;
  valid: boolean;
  error?: string;
  suggestNegativeCorrection?: boolean;
}

export interface CoordinateRow {
  id: string;
  latStr: string;
  lngStr: string;
  parsedLat?: number;
  parsedLng?: number;
  isValid: boolean;
  error?: string;
  isBrazilMissingNegative?: boolean;
}

/**
 * Parses a single latitude or longitude string into decimal degrees.
 * Accepts:
 * - -17.7924
 * - -17,7924
 * - 17°47'32.6"S
 * - 17° 47' 32.6" S
 * - 17 47 32.6 S
 * - 50°55'09.1"O (Oeste / West)
 * - 50°55'09.1"W
 */
export function parseSingleDegree(value: string, isLatitudeHint?: boolean): { val: number; isDmsNegative: boolean } | null {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // 1. Check for cardinal direction letters (S, N, W, O, E, L)
  const dirMatch = trimmed.match(/[sSnNwWoOeElL]/);
  const direction = dirMatch ? dirMatch[0].toUpperCase() : null;
  const isSouthOrWest = direction === 'S' || direction === 'W' || direction === 'O';
  const isNorthOrEast = direction === 'N' || direction === 'E' || direction === 'L';

  // 2. Check DMS pattern: degrees° minutes' seconds"
  // E.g. 17° 47' 32.6" or 17 47 32.6 or 17°47'32.6"
  const dmsRegex = /([+-]?\d+)[°\s]+(\d+)(?:['\s]+([0-9.,]+))?["'\s]*([sSnNwWoOeElL])?/;
  const dmsMatch = trimmed.match(dmsRegex);

  if (dmsMatch) {
    const deg = Math.abs(parseFloat(dmsMatch[1].replace(',', '.')));
    const min = parseFloat(dmsMatch[2].replace(',', '.')) || 0;
    const sec = dmsMatch[3] ? parseFloat(dmsMatch[3].replace(',', '.')) : 0;

    let decimal = deg + min / 60 + sec / 3600;

    const hasMinusSign = trimmed.startsWith('-') || dmsMatch[1].startsWith('-');
    if (hasMinusSign || isSouthOrWest) {
      decimal = -Math.abs(decimal);
    }

    return { val: decimal, isDmsNegative: hasMinusSign || isSouthOrWest };
  }

  // 3. Simple Decimal format with dot or comma (e.g. -17.7924 or -17,7924)
  // Clean out degree symbols, quotes, spaces, and cardinal letters
  const cleaned = trimmed
    .replace(/[°'""sSnNwWoOeElL]/g, '')
    .trim()
    .replace(',', '.');

  const parsed = parseFloat(cleaned);
  if (!isNaN(parsed) && isFinite(parsed)) {
    let finalVal = parsed;
    if (isSouthOrWest) {
      finalVal = -Math.abs(parsed);
    } else if (isNorthOrEast) {
      finalVal = Math.abs(parsed);
    }
    return { val: finalVal, isDmsNegative: isSouthOrWest || parsed < 0 };
  }

  return null;
}

/**
 * Validates whether latitude and longitude are within Earth bounds
 * and checks if they look like Brazilian coordinates without negative sign.
 */
export function validateCoordinate(
  lat: number,
  lng: number,
  rawLatStr = '',
  rawLngStr = ''
): { valid: boolean; error?: string; isBrazilMissingNegative?: boolean } {
  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, error: 'Coordenadas numéricas inválidas.' };
  }

  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'A latitude deve estar entre -90° e +90°.' };
  }

  if (lng < -180 || lng > 180) {
    return { valid: false, error: 'A longitude deve estar entre -180° e +180°.' };
  }

  // Brazilian territory bounds (approximate):
  // Lat: ~5° N to -34° S (mostly negative, South of Equator)
  // Lng: ~-34° W to -74° W (all negative, West of Greenwich)
  // If user entered positive lat (between 0 and 35) and positive lng (between 30 and 75),
  // they almost certainly forgot the negative sign for Brazil!
  const looksLikeBrazilWithoutMinus =
    lat > 0 &&
    lat <= 35 &&
    lng > 0 &&
    lng <= 75 &&
    !rawLatStr.toLowerCase().includes('n') &&
    !rawLngStr.toLowerCase().includes('e') &&
    !rawLngStr.toLowerCase().includes('l');

  return {
    valid: true,
    isBrazilMissingNegative: looksLikeBrazilWithoutMinus,
  };
}

/**
 * Parses a pair of raw lat/lng strings
 */
export function parseCoordinatePair(latStr: string, lngStr: string): CoordinateRow {
  const parsedLatObj = parseSingleDegree(latStr, true);
  const parsedLngObj = parseSingleDegree(lngStr, false);

  if (!parsedLatObj && !parsedLngObj && !latStr.trim() && !lngStr.trim()) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      latStr,
      lngStr,
      isValid: false,
      error: 'Vazio',
    };
  }

  if (!parsedLatObj) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      latStr,
      lngStr,
      isValid: false,
      error: 'Latitude inválida (ex: -17.79 ou 17°47\'32"S)',
    };
  }

  if (!parsedLngObj) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      latStr,
      lngStr,
      isValid: false,
      error: 'Longitude inválida (ex: -50.91 ou 50°55\'09"W)',
    };
  }

  const lat = parsedLatObj.val;
  const lng = parsedLngObj.val;

  const validation = validateCoordinate(lat, lng, latStr, lngStr);

  return {
    id: Math.random().toString(36).substring(2, 9),
    latStr,
    lngStr,
    parsedLat: lat,
    parsedLng: lng,
    isValid: validation.valid,
    error: validation.error,
    isBrazilMissingNegative: validation.isBrazilMissingNegative,
  };
}

/**
 * Parses a multi-line pasted text containing coordinates in any format.
 * Examples supported:
 * -17.7845, -50.9320
 * -17.7820 -50.9180
 * 17°47'32"S, 50°55'09"W
 * Lat: -17,7924 | Long: -50,9192
 * Tab-separated (copied from Excel/Sheets)
 */
export function parsePastedCoordinateText(rawText: string): CoordinateRow[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const rows: CoordinateRow[] = [];

  for (const line of lines) {
    // Try splitting by tab, comma, semicolon, pipe, or multiple spaces
    // But be careful not to split inside degrees symbols or DMS
    let parts: string[] = [];

    if (line.includes('\t')) {
      parts = line.split('\t').map((p) => p.trim());
    } else if (line.includes(';')) {
      parts = line.split(';').map((p) => p.trim());
    } else if (line.includes('|')) {
      parts = line.split('|').map((p) => p.trim());
    } else if (line.includes(',') && !line.includes('°')) {
      // If no degree sign, check if comma is separating lat/lng or decimal
      // E.g. "-17.7845, -50.9320" -> 2 parts
      // But "-17,7845, -50,9320" -> 4 parts or 2 parts with space
      if (line.includes(', ')) {
        parts = line.split(', ').map((p) => p.trim());
      } else {
        const commaCount = (line.match(/,/g) || []).length;
        if (commaCount === 1) {
          parts = line.split(',').map((p) => p.trim());
        } else if (commaCount === 2 || commaCount === 3) {
          // Likely "-17,79, -50,92" or "-17,79 -50,92"
          const spaceSplit = line.split(/\s+/);
          if (spaceSplit.length >= 2) {
            parts = spaceSplit;
          }
        }
      }
    } else if (line.includes(', ') && line.includes('°')) {
      // E.g. "17°47'32"S, 50°55'09"W"
      parts = line.split(', ').map((p) => p.trim());
    } else {
      // Fallback: split by space or check cardinal letters
      // E.g. "17°47'32"S 50°55'09"W"
      const dmsCardinalSplit = line.match(/(.*?[sSnN])\s*(.*?[wWoOeE].*)/);
      if (dmsCardinalSplit) {
        parts = [dmsCardinalSplit[1].trim(), dmsCardinalSplit[2].trim()];
      } else {
        const spaces = line.split(/\s{2,}|\s+/);
        if (spaces.length >= 2) {
          parts = [spaces[0], spaces.slice(1).join(' ')];
        }
      }
    }

    if (parts.length >= 2) {
      const latStr = parts[0].replace(/lat(itude)?[:\s]*/i, '').trim();
      const lngStr = parts[1].replace(/lon(gitude)?[:\s]*/i, '').trim();
      const row = parseCoordinatePair(latStr, lngStr);
      rows.push(row);
    } else if (parts.length === 1 && parts[0]) {
      // Single item on line, try to extract two numbers
      const numMatch = parts[0].match(/([+-]?[0-9]+[.,][0-9]+)\D+([+-]?[0-9]+[.,][0-9]+)/);
      if (numMatch) {
        const row = parseCoordinatePair(numMatch[1], numMatch[2]);
        rows.push(row);
      }
    }
  }

  return rows;
}
