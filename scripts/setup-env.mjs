// Pushes server-side secrets into the configured Convex deployment so all
// outbound API calls (OrangeSlice, Reddit, Anthropic) stay server-side.
//
//   - ORANGESLICE_API_KEY is auto-read from the OrangeSlice CLI's local config
//     (~/.config/orangeslice/config.json) unless overridden in .env.secrets.
//   - Everything else comes from ./.env.secrets (copy .env.secrets.example).
//
// Run after `convex dev` has configured a deployment:  pnpm run secrets
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (k) out[k] = v;
  }
  return out;
}

const secrets = parseEnvFile(join(root, ".env.secrets"));

// OrangeSlice key from the local CLI login, unless explicitly overridden.
if (!secrets.ORANGESLICE_API_KEY) {
  const cfg = join(homedir(), ".config", "orangeslice", "config.json");
  if (existsSync(cfg)) {
    try {
      const key = JSON.parse(readFileSync(cfg, "utf8")).apiKey;
      if (key) {
        secrets.ORANGESLICE_API_KEY = key;
        console.log("  • OrangeSlice key found in ~/.config/orangeslice/config.json");
      }
    } catch {
      // ignore malformed config
    }
  }
}

const KEYS = [
  "ORANGESLICE_API_KEY",
  "REDDIT_CLIENT_ID",
  "REDDIT_CLIENT_SECRET",
  "REDDIT_USER_AGENT",
  "ANTHROPIC_API_KEY",
];

// Local/anonymous deployments need CONVEX_AGENT_MODE=anonymous for CLI commands.
const envLocal = parseEnvFile(join(root, ".env.local"));
const deployment = envLocal.CONVEX_DEPLOYMENT || "";
const childEnv = { ...process.env };
if (/^(anonymous|local)/i.test(deployment)) childEnv.CONVEX_AGENT_MODE = "anonymous";

let set = 0;
const missing = [];
for (const k of KEYS) {
  const v = secrets[k];
  if (!v) {
    missing.push(k);
    continue;
  }
  const r = spawnSync("npx", ["convex", "env", "set", k, v], {
    stdio: ["ignore", "ignore", "inherit"],
    env: childEnv,
  });
  if (r.status === 0) {
    console.log(`  ✓ set ${k}`);
    set++;
  } else {
    console.error(`  ✗ failed to set ${k}`);
  }
}

console.log(`\nDone — ${set} variable(s) pushed to the Convex deployment.`);
if (missing.length) {
  console.log(`Not provided (add to .env.secrets if needed): ${missing.join(", ")}`);
}
