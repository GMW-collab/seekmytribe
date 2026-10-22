// Lightweight, privacy-friendly spam protection with no third-party CAPTCHA:
//  1. A honeypot field that people never see but bots fill in.
//  2. A signed timestamp: forms submitted in under 3 seconds, or more than a
//     day after the page loaded, or with a forged token, are rejected.
//  3. A per-IP rate limit held in memory (resets when the server restarts).

import { createHmac, timingSafeEqual } from "node:crypto";

export const HONEYPOT_FIELD = "website";
export const TOKEN_FIELD = "_t";
const MIN_AGE_MS = 3_000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function sign(ts: string, secret: string): string {
  return createHmac("sha256", secret).update(ts).digest("base64url");
}

export function makeToken(secret: string, now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts, secret)}`;
}

export type TokenCheck = "ok" | "missing" | "forged" | "too-fast" | "expired";

export function checkToken(token: string | undefined, secret: string, now = Date.now()): TokenCheck {
  if (!token) return "missing";
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return "forged";
  const expected = Buffer.from(sign(ts, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "forged";
  const age = now - Number(ts);
  if (age < MIN_AGE_MS) return "too-fast";
  if (age > MAX_AGE_MS) return "expired";
  return "ok";
}

export class RateLimiter {
  private hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit = 5, windowMs = 10 * 60 * 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Records a hit and returns true if the caller is still within the limit. */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [k, v] of this.hits) {
      if (v.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
    }
  }
}
