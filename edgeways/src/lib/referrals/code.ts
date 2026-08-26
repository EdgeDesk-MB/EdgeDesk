/**
 * EDGE-67 referral codes. Anonymous by design — matched betters operate in
 * disguise, so codes carry no name or email fragment. Format XXXX-XXXX from
 * an alphabet that drops 0/O and 1/I/L so codes survive being read aloud.
 * 29^8 combinations; collisions are handled by a retry loop on insert.
 */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUP_LENGTH = 4;
const CODE_PATTERN = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isReferralCodeFormat(code: string): boolean {
  return CODE_PATTERN.test(code);
}

export function generateReferralCode(
  random: () => number = Math.random
): string {
  let body = "";
  for (let i = 0; i < GROUP_LENGTH * 2; i += 1) {
    const index = Math.floor(random() * CODE_ALPHABET.length);
    body += CODE_ALPHABET[Math.min(index, CODE_ALPHABET.length - 1)];
  }
  return `${body.slice(0, GROUP_LENGTH)}-${body.slice(GROUP_LENGTH)}`;
}

/** Share link carried into sign-up: https://edgeways.app/sign-up?ref=CODE. */
export function referralShareUrl(code: string, origin = "https://edgeways.app"): string {
  return `${origin}/sign-up?ref=${encodeURIComponent(code)}`;
}
