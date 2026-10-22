// Framework-free form handling, so the same logic can sit behind the bundled
// Node server or be moved into a serverless function later.

import type { FormDef } from "./definitions.ts";
import { validateForm, formatSubmission, type RawFields } from "./validate.ts";
import { checkToken, HONEYPOT_FIELD, TOKEN_FIELD, type RateLimiter } from "./spam.ts";
import type { Sender } from "./mailer.ts";

export interface HandlerDeps {
  forms: Record<string, FormDef>;
  secret: string;
  limiter: RateLimiter;
  send: Sender;
  contactEmail: string;
  now?: () => number;
  log?: (msg: string) => void;
}

export interface HandlerResult {
  status: number;
  body: {
    ok: boolean;
    message: string;
    errors?: Record<string, string>;
    redirect?: string;
  };
}

export async function handleSubmission(formId: string, fields: RawFields, ip: string, deps: HandlerDeps): Promise<HandlerResult> {
  const now = deps.now ? deps.now() : Date.now();
  const log = deps.log ?? (() => {});
  const def = deps.forms[formId];
  if (!def) return { status: 404, body: { ok: false, message: "That form doesn't exist." } };

  // Honeypot: pretend success so bots learn nothing.
  const honey = fields[HONEYPOT_FIELD];
  if (typeof honey === "string" && honey.trim() !== "") {
    log(`spam: honeypot filled on ${formId}`);
    return { status: 200, body: { ok: true, message: def.successMessage, redirect: `/thanks/${formId}/` } };
  }

  if (!deps.limiter.allow(`${formId}:${ip}`, now)) {
    return {
      status: 429,
      body: { ok: false, message: `You've sent this form several times in a short while. Please wait ten minutes and try again, or email ${deps.contactEmail}.` },
    };
  }

  const token = typeof fields[TOKEN_FIELD] === "string" ? (fields[TOKEN_FIELD] as string) : undefined;
  const tokenState = await checkToken(token, deps.secret, now);
  if (tokenState === "too-fast") {
    return { status: 400, body: { ok: false, message: "That was quicker than we expected. Please check your answers and send the form again." } };
  }
  if (tokenState !== "ok") {
    log(`form token ${tokenState} on ${formId}`);
    return { status: 400, body: { ok: false, message: "This form has expired. Please reload the page and try again — your answers may need re-entering." } };
  }

  const result = validateForm(def, fields);
  if (!result.ok) {
    return { status: 422, body: { ok: false, message: "Some answers need checking.", errors: result.errors } };
  }

  const replyTo = def.replyTo && typeof result.data[def.replyTo] === "string" ? (result.data[def.replyTo] as string) : undefined;
  const sent = await deps.send({
    subject: `[Seek My Tribe] ${def.subject}`,
    text: formatSubmission(def, result.data, new Date(now)),
    replyTo: replyTo || undefined,
  });

  if (!sent.ok) {
    log(`form ${formId} not delivered: ${sent.reason}${"detail" in sent && sent.detail ? ` (${sent.detail})` : ""}`);
    const message = sent.reason === "not-configured"
      ? `Sorry, this form isn't switched on yet. Please email ${deps.contactEmail} instead.`
      : `Sorry, your form couldn't be sent just now. Please try again in a few minutes, or email ${deps.contactEmail}.`;
    return { status: 503, body: { ok: false, message } };
  }

  return { status: 200, body: { ok: true, message: def.successMessage, redirect: `/thanks/${formId}/` } };
}
