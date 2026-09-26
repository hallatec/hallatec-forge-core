import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FORGE_DIR = path.resolve(__dirname, "../../forge");

const repos = [
  "hallatec-forge-hub",
  "hallatec-emailguard",
  "hallatec-hscore",
  "hallatec-attackrank",
  "hallatec-trustkey",
  "hallatec-aegis365",
  "hallatec-lifeline",
  "hallatec-lockfall",
  "hallatec-coremap",
];

const oldSnippet =
  "The `assets/` design system is shared across all nine repositories as\n" +
  "identical copies, so each tool stays standalone and buildless. Component\n" +
  "changes should be propagated to the siblings above.";

const newSnippet =
  "### Shared Design Core: One Rule\n\n" +
  "The files under `assets/` (`hallatec.css` and `hallatec.js`) are generated and distributed from the canonical core repository: [**`hallatec/hallatec-forge-core`**](https://github.com/hallatec/hallatec-forge-core).\n\n" +
  "**Do not edit `assets/hallatec.{css,js}` directly in this repository.** Any changes to design tokens, styles, or shared components must be made in `hallatec-forge-core`, which automatically validates, updates per-repo attribution headers and provenance blocks, and submits Pull Requests across all nine tools.";

for (const r of repos) {
  const p = path.join(FORGE_DIR, r, "README.md");
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
    if (content.includes(oldSnippet)) {
      content = content.replace(oldSnippet, newSnippet);
      fs.writeFileSync(p, content, "utf8");
      console.log(`Updated README.md in ${r}`);
    } else {
      console.log(`Could not find oldSnippet in ${r}`);
    }
  } else {
    console.log(`File not found: ${p}`);
  }
}
