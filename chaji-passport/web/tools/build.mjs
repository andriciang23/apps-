// Wraps the page fragment (index.html, also published as-is for previews) in a
// full document and copies the static files to web/dist for hosting.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(web, "dist");
mkdirSync(dist, { recursive: true });

const fragment = readFileSync(join(web, "index.html"), "utf8");
const [head, body] = fragment.split(/(?=<div class="strip")/);
writeFileSync(
  join(dist, "index.html"),
  `<!doctype html>
<html lang="en-MY">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}</head>
<body>
${body}</body>
</html>
`,
);
for (const f of ["teas.js", "manifest.webmanifest", "icon.svg", "sw.js"]) cpSync(join(web, f), join(dist, f));
console.log("web/dist ready");
