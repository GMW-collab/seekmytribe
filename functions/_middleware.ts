// Cloudflare Pages middleware: adds a fresh spam-protection token to each page's forms.
// Static files (CSS, JS, images, fonts) skip this; see public/_routes.json.
import { injectFormTokens, type PagesEnv } from "../src/cloudflare/pages.ts";

interface Context {
  env: PagesEnv;
  next: () => Promise<Response>;
}

export const onRequest = async (context: Context): Promise<Response> => injectFormTokens(await context.next(), context.env);
