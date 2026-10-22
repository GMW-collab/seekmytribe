import { mkdtempSync, cpSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A temporary copy of /content with the test fixture activities added. */
export function contentWithFixtures(): string {
  const dir = mkdtempSync(join(tmpdir(), "smt-content-"));
  cpSync(join(ROOT, "content"), dir, { recursive: true });
  const fixtures = join(ROOT, "tests", "fixtures", "activities");
  for (const f of readdirSync(fixtures)) cpSync(join(fixtures, f), join(dir, "activities", f));
  return dir;
}

export function tempDir(prefix = "smt-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}
