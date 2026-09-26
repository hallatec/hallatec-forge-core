import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// Resolve @hallatec/tokens
let tokens;
try {
  tokens = await import("@hallatec/tokens");
} catch {
  const localTokens = path.resolve(ROOT, "../hallatec-tokens/dist/index.mjs");
  if (fs.existsSync(localTokens)) {
    tokens = await import(`file://${localTokens.replace(/\\/g, "/")}`);
  } else {
    throw new Error("Could not resolve @hallatec/tokens package or local sibling");
  }
}

// 1. Regenerate tools.tsv
const toolsPath = path.join(ROOT, "tools.tsv");
const generatedTsv = tokens.generateToolsTsv();
fs.writeFileSync(toolsPath, generatedTsv, "utf8");
console.log("✓ tools.tsv generated from @hallatec/tokens");

// 2. Regenerate hallatec.css tokens block
const cssPath = path.join(ROOT, "hallatec.css");
const currentCss = fs.readFileSync(cssPath, "utf8");

const tokenStartMarker = "/* ---------- 1. TOKENS ---------- */";
const tokenEndMarker = "/* ---------- 2. RESET / BASE ---------- */";

const startIndex = currentCss.indexOf(tokenStartMarker);
const endIndex = currentCss.indexOf(tokenEndMarker);

if (startIndex === -1 || endIndex === -1) {
  throw new Error("Could not find token section markers in hallatec.css");
}

const before = currentCss.substring(0, startIndex);
const after = currentCss.substring(endIndex);
const newTokensBlock = tokens.generateForgeCoreTokensBlock() + "\n\n";

const newCss = before + newTokensBlock + after;
fs.writeFileSync(cssPath, newCss, "utf8");
console.log("✓ hallatec.css generated from @hallatec/tokens (reproduces byte-identical tokens)");

console.log("Build complete.");
