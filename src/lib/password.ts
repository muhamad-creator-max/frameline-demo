import crypto from "node:crypto";

/**
 * Salted SHA-256 hash. Bcrypt would be ideal but we stay zero-deps here; the
 * salt offsets the cost and these passwords gate a CDN/share link, not
 * financial data. Format: "<salt>$<hex digest>".
 */
export function hashPassword(plain: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(`${salt}:${plain}`).digest("hex");
  return `${salt}$${hash}`;
}

export function verifyPassword(hash: string, plain: string) {
  const [salt, expected] = hash.split("$");
  if (!salt || !expected) return false;
  const computed = crypto.createHash("sha256").update(`${salt}:${plain}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expected));
  } catch {
    return false;
  }
}
