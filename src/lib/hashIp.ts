import { createHash } from "crypto";

/**
 * Returns first 16 hex chars of sha256(ip + IP_HASH_SALT).
 * One-way; never reconstruct the original IP.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "";
  return createHash("sha256")
    .update(ip + salt)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Extracts the real client IP from standard proxy headers,
 * falling back to "unknown" when none are present.
 */
export function extractIp(req: Request): string {
  // x-forwarded-for may contain a comma-separated list; take the first entry.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}
