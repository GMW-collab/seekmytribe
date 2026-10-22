import type { FormDef, FieldDef } from "./definitions.ts";

export type RawFields = Record<string, string | string[] | undefined>;
export type CleanFields = Record<string, string | string[]>;

export interface ValidationResult {
  ok: boolean;
  data: CleanFields;
  errors: Record<string, string>;
}

// A pragmatic email check: something@something.tld, no spaces.
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:".]{2,}$/;
const TEL_RE = /^[0-9+()\-\s]{6,40}$/;

/** Remove control characters (keeping newlines and tabs) and trim. */
export function clean(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").trim();
}

function asList(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).map(clean).filter(Boolean);
}

function asString(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  return clean(Array.isArray(v) ? (v[0] ?? "") : v);
}

function fieldName(f: FieldDef): string {
  return f.label.replace(/\s*\(optional\)\s*$/i, "").replace(/\?$/, "").toLowerCase();
}

export function validateForm(def: FormDef, input: RawFields): ValidationResult {
  const data: CleanFields = {};
  const errors: Record<string, string> = {};

  for (const f of def.fields) {
    if (f.type === "checkboxes") {
      const values = asList(input[f.name]);
      const allowed = new Set((f.options ?? []).map((o) => o.value));
      const bad = values.filter((v) => !allowed.has(v));
      if (bad.length) errors[f.name] = "Choose from the options listed.";
      else if (f.required && values.length === 0) errors[f.name] = f.requiredMessage ?? "Choose at least one option.";
      data[f.name] = values;
      continue;
    }

    const value = asString(input[f.name]);
    data[f.name] = value;

    if (f.type === "consent") {
      const ticked = value === "yes";
      data[f.name] = ticked ? "yes" : "no";
      const dependsOn = f.requiredIf ? asString(input[f.requiredIf]) : "";
      if (!ticked && (f.required || (f.requiredIf && dependsOn))) {
        errors[f.name] = f.requiredIf
          ? "Tick this box so we can reply, or remove your email address."
          : "Tick this box to continue.";
      }
      continue;
    }

    if (!value) {
      if (f.required) {
        errors[f.name] = f.requiredMessage ?? (f.type === "select" || f.type === "radio"
          ? `Choose an option for ${fieldName(f)}.`
          : `Enter ${f.type === "email" ? "your email address" : fieldName(f)}.`);
      }
      continue;
    }

    if (f.maxLength && value.length > f.maxLength) {
      errors[f.name] = `Keep this to ${f.maxLength.toLocaleString("en-GB")} characters or fewer (currently ${value.length.toLocaleString("en-GB")}).`;
      continue;
    }
    if (f.type === "email" && !EMAIL_RE.test(value)) {
      errors[f.name] = "Enter an email address in the format name@example.com.";
    }
    if (f.type === "tel" && !TEL_RE.test(value)) {
      errors[f.name] = "Enter a phone number using digits, spaces and + only.";
    }
    if ((f.type === "select" || f.type === "radio") && !(f.options ?? []).some((o) => o.value === value)) {
      errors[f.name] = "Choose from the options listed.";
    }
  }

  return { ok: Object.keys(errors).length === 0, data, errors };
}

/** Turn validated data into a readable plain-text email body. */
export function formatSubmission(def: FormDef, data: CleanFields, submittedAt: Date): string {
  const lines: string[] = [`${def.title}`, `Received ${submittedAt.toISOString()}`, ""];
  for (const f of def.fields) {
    const v = data[f.name];
    let shown: string;
    if (Array.isArray(v)) {
      const labels = v.map((x) => f.options?.find((o) => o.value === x)?.label ?? x);
      shown = labels.length ? labels.join(", ") : "(none)";
    } else if (f.options && v) {
      shown = f.options.find((o) => o.value === v)?.label ?? v;
    } else {
      shown = v || "(not given)";
    }
    lines.push(`${f.label.replace(/\s*\(optional\)\s*$/i, "")}:`);
    lines.push(shown);
    lines.push("");
  }
  lines.push("--");
  lines.push("Sent from the Seek My Tribe website. Handle in line with the privacy notice: delete personal details when no longer needed.");
  return lines.join("\n");
}
