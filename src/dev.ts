// Local development: rebuild the preview, then serve it. `npm run dev` restarts
// this file whenever anything in src/ or content/ changes.
import { build } from "./build.ts";
import { createSiteServer } from "./server.ts";

const fontSource = process.env.FONT_SOURCE === "google" ? "google" : "self";
build({ mode: "preview", siteUrl: "http://localhost:8080", fontSource });
const port = Number(process.env.PORT) || 8080;
createSiteServer({ fontSource }).listen(port, () => console.log(`Preview at http://localhost:${port}`));
