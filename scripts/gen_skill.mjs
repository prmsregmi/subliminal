// Regenerate the verbatim skill-text modules from their source markdown so the
// full skill ships as a bundled string (Convex actions can't read files at
// runtime). Run after editing either skill: `node scripts/gen_skill.mjs`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Each source .md is embedded verbatim into a generated .ts module as one export.
const FILES = [
  {
    src: "reddit-content-skill.md",
    out: "convex/lib/draft_skill.ts",
    exportName: "CONTENT_SKILL",
    note: "the MAIN system prompt for draft + post generation; the per-call craft rules in drafts.ts / posts.ts ride alongside it.",
  },
  {
    src: "finding-matching-subreddit.md",
    out: "convex/lib/skill_text.ts",
    exportName: "SUBREDDIT_TARGETING_SKILL",
    note: "the full subreddit-targeting methodology; skill.ts adds a short per-phase focus directive on top for each targeting call.",
  },
];

// Escape only the sequences that would break a template literal, so the embedded
// text stays byte-for-byte identical to the source markdown.
const esc = (s) =>
  s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

for (const f of FILES) {
  const md = readFileSync(join(root, f.src), "utf8");
  const header =
    `// Generated from ${f.src} — verbatim, do not edit by hand.\n` +
    `// Embedded as a bundled string because Convex actions cannot read files at\n` +
    `// runtime. This is ${f.note}\n` +
    `// Regenerate with: node scripts/gen_skill.mjs\n`;
  writeFileSync(
    join(root, f.out),
    `${header}export const ${f.exportName} = \`${esc(md)}\`;\n`,
    "utf8",
  );
  console.log(`regenerated ${f.out} (${md.length} chars from ${f.src})`);
}
