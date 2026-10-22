// Cloudflare Pages Function: POST /api/forms/:form
import { onFormPost, type PagesEnv, type SiteData } from "../../../src/cloudflare/pages.ts";
// Written by the build (npm run build:*). Not committed.
import site from "../../_generated/site.json" with { type: "json" };

interface Context {
  request: Request;
  env: PagesEnv;
  params: { form?: string | string[] };
}

export const onRequestPost = async ({ request, env, params }: Context): Promise<Response> => {
  const formId = Array.isArray(params.form) ? (params.form[0] ?? "") : (params.form ?? "");
  return onFormPost(request, env, formId, site as SiteData);
};

export const onRequest = async (): Promise<Response> => new Response(null, { status: 405, headers: { Allow: "POST" } });
