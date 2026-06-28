// Parses the subreddit catalog markdown table and bulk-imports it into the
// Convex `subreddits` table. Idempotent: re-running replaces the table's rows.
//
//   pnpm run import:subreddits [path/to/table.md]   # defaults to data/subreddits.md
//
// The markdown is a GitHub-flavored table with two columns:
//   | Subreddit | Description |
// Names may carry an "/r/" prefix; it is stripped. Targets the same Convex
// deployment as `pnpm run secrets` (reads .env.local, honors anonymous mode).
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const mdPath = process.argv[2] || join(root, "data", "subreddits.md");

if (!existsSync(mdPath)) {
  console.error(`Markdown catalog not found: ${mdPath}`);
  process.exit(1);
}

// --- Parse the GitHub-flavored markdown table ---
const lines = readFileSync(mdPath, "utf8").split("\n");
const rows = [];
const seen = new Set();
let dupes = 0;
let skipped = 0;

for (const raw of lines) {
  const line = raw.trim();
  if (!line.startsWith("|")) continue;
  // Cells between the outer pipes.
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  if (cells.length < 2) {
    skipped++;
    continue;
  }
  let name = cells[0];
  // A description could itself contain a pipe; rejoin everything after col 1.
  const description = cells.slice(1).join(" | ").trim();
  // Skip the header row and the |---|---| separator row.
  if (/^:?-+:?$/.test(name) || name.toLowerCase() === "subreddit") {
    skipped++;
    continue;
  }
  name = name.replace(/^\/?r\//i, "").trim(); // strip leading "/r/" or "r/"
  if (!name || !description) {
    skipped++;
    continue;
  }
  const nameLower = name.toLowerCase();
  if (seen.has(nameLower)) {
    dupes++;
    continue;
  }
  seen.add(nameLower);
  rows.push({ name, nameLower, description, createdAt: Date.now() });
}

if (!rows.length) {
  console.error("No subreddit rows parsed — check the markdown table format.");
  process.exit(1);
}
console.log(
  `Parsed ${rows.length} subreddits (${dupes} duplicate names dropped, ${skipped} non-data lines skipped).`,
);

// --- Bulk-import (replace) into Convex via JSONL ---
const dir = mkdtempSync(join(tmpdir(), "subreddits-"));
const jsonlPath = join(dir, "subreddits.jsonl");
writeFileSync(jsonlPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

// Match setup-env.mjs: anonymous/local deployments need CONVEX_AGENT_MODE.
function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const l of readFileSync(path, "utf8").split("\n")) {
    const t = l.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}
const deployment = parseEnvFile(join(root, ".env.local")).CONVEX_DEPLOYMENT || "";
const childEnv = { ...process.env };
if (/^(anonymous|local)/i.test(deployment)) childEnv.CONVEX_AGENT_MODE = "anonymous";

const r = spawnSync(
  "npx",
  ["convex", "import", "--table", "subreddits", jsonlPath, "--replace", "-y"],
  { stdio: "inherit", env: childEnv },
);
process.exit(r.status ?? 1);
