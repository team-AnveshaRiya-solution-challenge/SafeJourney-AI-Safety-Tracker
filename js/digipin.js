// ============================================================
// FILE: js/digipin.js
// IMPORTS: Nothing
// IMPORTED BY: tracking.js, guardian.js
//
// Generates a placeholder DIGIPIN from GPS coordinates.
// DIGIPIN is India Post's system to give every 4×4 metre area
// a unique alphanumeric code. The real API isn't public yet,
// so this mock mimics the output format.
// ============================================================

/**
 * Generates a mock DIGIPIN from latitude and longitude.
 * Output format: "ABC-123"  (3 chars, dash, 3 chars)
 *
 * Replace the body of this function when India Post's API goes public.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {string}  e.g. "M4R-7N2"
 */
export function generateDigipin(lat, lng) {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O,0,I,1 (confusing)

  const latInt = Math.abs(Math.round(lat * 1000));
  const lngInt = Math.abs(Math.round(lng * 1000));

  const part1 =
    CHARS[ latInt        % CHARS.length] +
    CHARS[(latInt  >> 3) % CHARS.length] +
    String(lngInt % 10);

  const part2 =
    CHARS[ lngInt        % CHARS.length] +
    CHARS[(lngInt  >> 3) % CHARS.length] +
    String(latInt % 10);

  return `${part1}-${part2}`;
}
