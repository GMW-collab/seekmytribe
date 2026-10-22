import { test } from "node:test";
import assert from "node:assert/strict";
import { buildForms } from "../src/forms/definitions.ts";
import { validateForm, formatSubmission, clean } from "../src/forms/validate.ts";
import { makeToken, checkToken, RateLimiter } from "../src/forms/spam.ts";
import { handleSubmission, type HandlerDeps } from "../src/forms/handler.ts";
import { createResendSender, type OutgoingEmail } from "../src/forms/mailer.ts";

const forms = buildForms([{ id: "walking-outdoors", name: "Walking" }, { id: "shared-meals", name: "Meals" }]);
const SECRET = "test-secret";

test("contact form: required fields and formats", () => {
  const r = validateForm(forms.contact!, { name: "", email: "not-an-email", topic: "made-up", message: "" });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ["email", "message", "name", "topic"]);
  assert.match(r.errors.email!, /name@example\.com/);
});

test("contact form: valid input passes and is cleaned", () => {
  const r = validateForm(forms.contact!, { name: "  Sam\u0007 ", email: "sam@example.org", topic: "general", message: "Hi\r\nthere" });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.data.name, "Sam");
  assert.equal(r.data.message, "Hi\nthere");
});

test("checkbox groups only accept listed options", () => {
  const r = validateForm(forms.volunteer!, { name: "A", email: "a@b.co", area: "X", ways: ["hosting", "hacking"] });
  assert.equal(r.errors.ways, "Choose from the options listed.");
  const none = validateForm(forms.volunteer!, { name: "A", email: "a@b.co", area: "X" });
  assert.match(none.errors.ways!, /at least one/);
});

test("consent is required where it should be, and conditionally on the suggestion form", () => {
  assert.ok(validateForm(forms.updates!, { email: "a@b.co" }).errors.consent);
  const anonymous = validateForm(forms.suggest!, { idea: "Chess", area: "Here", help: "no" });
  assert.equal(anonymous.ok, true, JSON.stringify(anonymous.errors));
  const withEmail = validateForm(forms.suggest!, { idea: "Chess", area: "Here", help: "no", email: "a@b.co" });
  assert.match(withEmail.errors.consent_contact!, /remove your email/);
});

test("length limits are enforced on the server", () => {
  const r = validateForm(forms.contact!, { name: "A", email: "a@b.co", topic: "general", message: "x".repeat(3001) });
  assert.match(r.errors.message!, /3,000 characters/);
});

test("submissions are formatted with readable labels", () => {
  const r = validateForm(forms.interest!, { name: "A", email: "a@b.co", area: "E8", interests: ["shared-meals"], consent: "yes" });
  const text = formatSubmission(forms.interest!, r.data, new Date("2030-01-01T00:00:00Z"));
  assert.match(text, /Meals/);
  assert.match(text, /\(none\)/);
});

test("clean() strips control characters", () => {
  assert.equal(clean("a\u0000b\u001Fc"), "abc");
});

test("form tokens: valid, too fast, expired and forged", async () => {
  const t0 = 1_000_000_000_000;
  const token = await makeToken(SECRET, t0);
  assert.equal(await checkToken(token, SECRET, t0 + 5_000), "ok");
  assert.equal(await checkToken(token, SECRET, t0 + 1_000), "too-fast");
  assert.equal(await checkToken(token, SECRET, t0 + 2 * 86_400_000), "expired");
  assert.equal(await checkToken(token, "other-secret", t0 + 5_000), "forged");
  assert.equal(await checkToken(`${t0}.abc`, SECRET, t0 + 5_000), "forged");
  assert.equal(await checkToken(undefined, SECRET), "missing");
});

test("rate limiter allows five then blocks, and recovers", () => {
  const rl = new RateLimiter(5, 1000);
  for (let i = 0; i < 5; i++) assert.equal(rl.allow("ip", 0), true);
  assert.equal(rl.allow("ip", 10), false);
  assert.equal(rl.allow("other", 10), true);
  assert.equal(rl.allow("ip", 2000), true);
});

function deps(sent: OutgoingEmail[], result: "ok" | "not-configured" | "failed" = "ok"): HandlerDeps {
  return {
    forms,
    secret: SECRET,
    limiter: new RateLimiter(),
    contactEmail: "hello@example.org",
    now: () => 2_000_000_000_000,
    send: async (e) => {
      sent.push(e);
      return result === "ok" ? { ok: true } : { ok: false, reason: result };
    },
  };
}
const validContact = async () => ({ name: "Sam", email: "sam@example.org", topic: "general", message: "Hello", _t: await makeToken(SECRET, 2_000_000_000_000 - 10_000) });

test("handler: a valid submission is emailed with a reply-to", async () => {
  const sent: OutgoingEmail[] = [];
  const r = await handleSubmission("contact", (await validContact()), "1.1.1.1", deps(sent));
  assert.equal(r.status, 200);
  assert.equal(r.body.redirect, "/thanks/contact/");
  assert.equal(sent[0]?.replyTo, "sam@example.org");
  assert.match(sent[0]!.subject, /Website message/);
});

test("handler: honeypot submissions look successful but send nothing", async () => {
  const sent: OutgoingEmail[] = [];
  const r = await handleSubmission("contact", { ...(await validContact()), website: "http://spam" }, "1.1.1.1", deps(sent));
  assert.equal(r.body.ok, true);
  assert.equal(sent.length, 0);
});

test("handler: invalid answers return field errors and send nothing", async () => {
  const sent: OutgoingEmail[] = [];
  const r = await handleSubmission("contact", { ...(await validContact()), email: "nope" }, "1.1.1.1", deps(sent));
  assert.equal(r.status, 422);
  assert.ok(r.body.errors?.email);
  assert.equal(sent.length, 0);
});

test("handler: if email isn't set up, visitors are told plainly where to write instead", async () => {
  const r = await handleSubmission("contact", (await validContact()), "1.1.1.1", deps([], "not-configured"));
  assert.equal(r.status, 503);
  assert.match(r.body.message, /isn't switched on yet.*hello@example\.org/);
});

test("handler: unknown forms and missing tokens are refused", async () => {
  assert.equal((await handleSubmission("nope", {}, "ip", deps([]))).status, 404);
  const { _t, ...noToken } = (await validContact());
  void _t;
  assert.equal((await handleSubmission("contact", noToken, "ip", deps([]))).status, 400);
});

test("Resend sender reports not-configured without calling the network", async () => {
  let called = false;
  const send = createResendSender({}, (async () => { called = true; return new Response(); }) as typeof fetch);
  assert.deepEqual(await send({ subject: "s", text: "t" }), { ok: false, reason: "not-configured" });
  assert.equal(called, false);
});

test("Resend sender posts the expected payload", async () => {
  let body: Record<string, unknown> = {};
  const send = createResendSender({ apiKey: "k", from: "from@x.org", to: "to@x.org" }, (async (_u: string, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch);
  assert.deepEqual(await send({ subject: "s", text: "t", replyTo: "r@x.org" }), { ok: true });
  assert.deepEqual(body.to, ["to@x.org"]);
  assert.equal(body.reply_to, "r@x.org");
});
