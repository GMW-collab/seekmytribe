// Builds a throwaway copy of the site that includes the test fixture activities,
// and serves it, so the browser checks can exercise the activity filters.
// Never deploy this output.
import { build } from "../src/build.ts";
import { createSiteServer } from "../src/server.ts";
import { contentWithFixtures, tempDir } from "../tests/helpers.ts";

const out = tempDir("smt-fixture-dist-");
build({ mode: "preview", siteUrl: "http://localhost", fontSource: "self", contentDir: contentWithFixtures(), outDir: out, builtAt: new Date("2030-06-01T08:00:00Z"), quiet: true });
const port = Number(process.env.PORT) || 8091;
createSiteServer({ distDir: out, log: () => {} }).listen(port, () => console.log(`fixture site on ${port}`));
