/** Shared geospatial helpers, mirroring the backend's Haversine implementation. */

const EARTH_RADIUS_METERS = 6371000;

/** Great-circle distance between two WGS84 coordinates, in metres. */
export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Mask a phone number for public-facing UI, per the privacy rule in `docs/DECISIONS.md`
 * ("+91 98250 11223" -> "+91 98250 XXX23"). The backend returns unmasked contact
 * details, so masking is applied at the presentation layer.
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 5) return phone;

  let masked = '';
  let digitsSeen = 0;
  const firstMaskedIndex = digits.length - 5;

  for (const char of phone) {
    if (!/\d/.test(char)) {
      masked += char;
      continue;
    }
    // Mask the 5th-, 4th- and 3rd-from-last digits, keeping the last two visible.
    masked += digitsSeen >= firstMaskedIndex && digitsSeen < digits.length - 2 ? 'X' : char;
    digitsSeen += 1;
  }
  return masked;
}
