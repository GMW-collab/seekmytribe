// Lightweight, privacy-friendly spam protection with no third-party CAPTCHA:
//  1. A honeypot field that people never see but bots fill in.
//  2. A signed timestamp: forms submitted in under 3 seconds, or more than a
//     day after the page loaded, or with a forged token, are rejected.
//  3. A per-IP rate limit held in memory (per server process, or per
//     Cloudflare isolate, so it is a soft limit; see docs/HANDOVER.md).
//
// Uses Web Crypto so the same code runs in Node and on Cloudflare.

export const HONEYPOT_FIELD = "website";
export const TOKEN_FIELD = "_t";
const MIN_AGE_MS = 3_000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    keyCache.set(secret, key);
  }
  return key;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function makeToken(secret: string, now = Date.now()): Promise<string> {
  const ts = String(now);
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(ts));
  return `${ts}.${toBase64Url(sig)}`;
}

export type TokenCheck = "ok" | "missing" | "forged" | "too-fast" | "expired";

export async function checkToken(token: string | undefined, secret: string, now = Date.now()): Promise<TokenCheck> {
  if (!token) return "missing";
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return "forged";
  const sigBytes = fromBase64Url(sig);
  if (!sigBytes) return "forged";
  // crypto.subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), sigBytes, encoder.encode(ts));
  if (!valid) return "forged";
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
