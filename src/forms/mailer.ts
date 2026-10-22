// Email delivery for form submissions.
//
// The site doesn't store submissions in a database; each one is emailed to the
// team's inbox. Delivery uses Resend's HTTP API. If it isn't configured, the
// sender reports "not-configured" and the visitor is told plainly that the form
// isn't working yet, with the email address to use instead.

export interface OutgoingEmail {
  subject: string;
  text: string;
  replyTo?: string;
}

export type SendResult = { ok: true } | { ok: false; reason: "not-configured" | "failed"; detail?: string };
export type Sender = (email: OutgoingEmail) => Promise<SendResult>;

export interface MailConfig {
  apiKey?: string;
  from?: string;
  to?: string;
}

export function mailConfigFromEnv(env: NodeJS.ProcessEnv): MailConfig {
  return { apiKey: env.RESEND_API_KEY, from: env.FORM_FROM_EMAIL, to: env.FORM_TO_EMAIL };
}

export function isMailConfigured(c: MailConfig): boolean {
  return Boolean(c.apiKey && c.from && c.to);
}

export function createResendSender(config: MailConfig, fetchImpl: typeof fetch = fetch): Sender {
  return async (email) => {
    if (!isMailConfigured(config)) return { ok: false, reason: "not-configured" };
    try {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: config.from,
          to: [config.to],
          subject: email.subject,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return { ok: false, reason: "failed", detail: `Resend responded ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: "failed", detail: (err as Error).message };
    }
  };
}
