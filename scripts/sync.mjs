#!/usr/bin/env node

/**
 * sync.mjs — Hallatec Forge Core asset synchronization engine.
 *
 * Replaces sync-assets.sh with a portable, cross-platform engine used both locally
 * and within GitHub Actions (CI drift-check and automated cross-repo PR generation).
 *
 * Safety guards:
 *  - Truncation check: fails if core css < 200 lines or js < 150 lines.
 *  - Syntax validation: validates generated JS via Node's vm.Script before writing.
 *  - LF normalization: eliminates false-positive CRLF drift on Windows.
 *  - Preserves per-repo SPDX header and HTC.provenance object.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const ORG = "Hallatec Technology Solutions LLC";
const YEAR = "2026";
const GH_ORG = "hallatec";

// Parse CLI flags
const args = process.argv.slice(2);
const isCheck = args.includes("--check");
const isBump = args.includes("--bump");
const isWrite = args.includes("--write") || (!isCheck && !args.includes("--help"));
const targetDirArg = args.find((a) => a.startsWith("--target-dir="));
const TARGETS_DIR = targetDirArg
  ? path.resolve(targetDirArg.split("=")[1])
  : path.resolve(ROOT, "..", "forge");

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Usage: node scripts/sync.mjs [options]

Options:
  --check               Report drift without modifying files (exits 1 if drift detected)
  --write               Regenerate assets in all 9 tool repos (default unless --check is set)
  --bump                Increment cache-bust ?v=N in each tool's index.html
  --target-dir=<path>   Directory containing the cloned tool repos (default: ../forge)
  -h, --help            Show this help message
`);
  process.exit(0);
}

// 1. Load core files
const cssPath = path.join(ROOT, "hallatec.css");
const jsPath = path.join(ROOT, "hallatec.js");
const toolsPath = path.join(ROOT, "tools.tsv");

for (const p of [cssPath, jsPath, toolsPath]) {
  if (!fs.existsSync(p)) {
    console.error(`FATAL: missing required core file: ${p}`);
    process.exit(2);
  }
}

const coreCss = fs.readFileSync(cssPath, "utf8");
const coreJs = fs.readFileSync(jsPath, "utf8");

// Safety guard: truncation check
const cssLines = coreCss.split("\n").length;
const jsLines = coreJs.split("\n").length;
if (cssLines < 200 || jsLines < 150) {
  console.error(
    `FATAL: core files appear truncated (CSS=${cssLines}, JS=${jsLines}). Aborting.`
  );
  process.exit(2);
}

// Safety guard: syntax validation of core JS
try {
  new vm.Script(coreJs);
} catch (err) {
  console.error(`FATAL: hallatec.js has syntax error: ${err.message}`);
  process.exit(2);
}

// 2. Parse tools.tsv
const toolsRaw = fs.readFileSync(toolsPath, "utf8");
const tools = toolsRaw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const [id, repo, name, subdomain, pagesProject] = line.split("\t");
    return { id, repo, name, subdomain, pagesProject };
  });

function makeHeader(toolName, canonicalUrl, repoUrl, typeDescription) {
  return `/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * SPDX-FileCopyrightText: ${YEAR} ${ORG}
 * Additional terms: attribution required - see LICENSE-ADDITIONAL-TERMS
 *
 * ${toolName} - Hallatec Forge shared ${typeDescription}
 * Canonical: ${canonicalUrl}
 * Source:    ${repoUrl}
 */
`;
}

function makeProvenance(toolId, toolName, canonicalUrl, repoUrl) {
  return `
/* ---------------------------------------------------------------------
   PROVENANCE - machine-readable origin marker.
   Lets any deployment of this file be traced back to its canonical home
   and its source repository. See PROVENANCE.md for how to verify.
   --------------------------------------------------------------------- */
(function (w) {
  "use strict";
  var HTC = (w.HTC = w.HTC || {});
  HTC.provenance = Object.freeze({
    tool: "${toolId}",
    name: "${toolName}",
    suite: "Hallatec Forge",
    suiteUrl: "https://forge.hallatec.com/",
    canonical: "${canonicalUrl}",
    repository: "${repoUrl}",
    publisher: "${ORG}",
    license: "AGPL-3.0-or-later",
    licenseUrl: "https://www.gnu.org/licenses/agpl-3.0.html"
  });
})(window);
`;
}

function normalizeLF(content) {
  return content.replace(/\r\n/g, "\n");
}

let driftCount = 0;
let updatedCount = 0;

console.log(`Checking ${tools.length} Forge tool repos under: ${TARGETS_DIR}\n`);

for (const tool of tools) {
  const repoDir = path.join(TARGETS_DIR, tool.repo);
  const assetsDir = path.join(repoDir, "assets");

  if (!fs.existsSync(assetsDir)) {
    console.log(`SKIP (missing): ${tool.repo}`);
    continue;
  }

  const canon = `https://${tool.subdomain}/`;
  const repoUrl = `https://github.com/${GH_ORG}/${tool.repo}`;

  const generatedCss =
    makeHeader(tool.name, canon, repoUrl, "design system") + "\n" + coreCss;
  const generatedJs =
    makeHeader(tool.name, canon, repoUrl, "component library") +
    "\n" +
    coreJs +
    makeProvenance(tool.id, tool.name, canon, repoUrl);

  // Validate generated JS syntax
  try {
    new vm.Script(generatedJs);
  } catch (err) {
    console.error(`FATAL: generated JS invalid for ${tool.repo}: ${err.message}`);
    process.exit(1);
  }

  const destCss = path.join(assetsDir, "hallatec.css");
  const destJs = path.join(assetsDir, "hallatec.js");

  const currentCss = fs.existsSync(destCss) ? fs.readFileSync(destCss, "utf8") : "";
  const currentJs = fs.existsSync(destJs) ? fs.readFileSync(destJs, "utf8") : "";

  const cssDiff = normalizeLF(currentCss) !== normalizeLF(generatedCss);
  const jsDiff = normalizeLF(currentJs) !== normalizeLF(generatedJs);

  if (!cssDiff && !jsDiff) {
    console.log(`${tool.repo.padEnd(24)} in sync`);
    continue;
  }

  driftCount++;

  if (isCheck) {
    console.log(`${tool.repo.padEnd(24)} DRIFT`);
    continue;
  }

  if (isWrite) {
    fs.writeFileSync(destCss, normalizeLF(generatedCss), "utf8");
    fs.writeFileSync(destJs, normalizeLF(generatedJs), "utf8");
    let msg = "updated";

    // Optional cache-bust bump
    if (isBump) {
      const indexPath = path.join(repoDir, "index.html");
      if (fs.existsSync(indexPath)) {
        let indexHtml = fs.readFileSync(indexPath, "utf8");
        const match = indexHtml.match(/hallatec\.(?:css|js)\?v=(\d+)/);
        if (match) {
          const curV = parseInt(match[1], 10);
          const nextV = curV + 1;
          indexHtml = indexHtml
            .replace(/hallatec\.css\?v=\d+/g, `hallatec.css?v=${nextV}`)
            .replace(/hallatec\.js\?v=\d+/g, `hallatec.js?v=${nextV}`);
          fs.writeFileSync(indexPath, indexHtml, "utf8");
          msg += `, bumped v${curV}->v${nextV}`;
        }
      }
    }

    console.log(`${tool.repo.padEnd(24)} ${msg}`);
    updatedCount++;
  }
}

console.log("\n---");
if (isCheck) {
  if (driftCount > 0) {
    console.error(`Drift detected in ${driftCount} repo(s). Run sync to update.`);
    process.exit(1);
  } else {
    console.log("All nine tool repos in sync with forge-core.");
    process.exit(0);
  }
} else {
  console.log(`${updatedCount} repo(s) updated.`);
  process.exit(0);
}
