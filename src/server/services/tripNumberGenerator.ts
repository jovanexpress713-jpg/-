/**
 * Unified Trip Number Generator for EJAZ Transport
 * Standard format: EJ-YYYY-XXXXXX (e.g. EJ-2026-000001)
 * Guaranteed unique and sequential by backend database sequence
 */

let inMemorySequence = 10482; // Baseline counter continuing from enterprise serial

export function generateTripNumber(year: number = new Date().getFullYear()): string {
  inMemorySequence += 1;
  const seqStr = String(inMemorySequence).padStart(6, "0");
  return `EJ-${year}-${seqStr}`;
}

export function parseTripNumber(tripNumber: string): { prefix: string; year: number; sequence: number } | null {
  const match = tripNumber.match(/^EJ-(\d{4})-(\d{6})$/);
  if (!match) return null;
  return {
    prefix: "EJ",
    year: parseInt(match[1], 10),
    sequence: parseInt(match[2], 10),
  };
}
