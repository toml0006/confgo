#!/usr/bin/env node
// Parse design/Summary/flashcards.md into web/public/topics.json so the
// /demo/topics route can render each card without re-implementing the
// markdown extraction at runtime. Runs as part of `prebuild` so the
// deployed bundle always reflects the current flashcards file.
//
// Source-of-truth stays in flashcards.md; this is a derived artifact.
//
// IDs are derived from sha256(title) so re-running this script after
// editing flashcards.md is idempotent — unchanged cards keep their id
// (and thus their accumulated /topic_likes). Renaming a card produces
// a new id, which is the right semantic: a renamed card is a new card.

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

const here = fileURLToPath(new URL(".", import.meta.url));
const sourcePath = path.resolve(here, "..", "..", "design", "Summary", "flashcards.md");
const outPath = path.resolve(here, "..", "public", "topics.json");

const md = await fs.readFile(sourcePath, "utf8");

const topics = [];
let currentSection = null;
let buffer = null;

function topicIdFor(title) {
  const normalized = title.toLowerCase().replace(/\s+/g, " ").trim();
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  return `t_${hash.slice(0, 10)}`;
}

function commit() {
  if (!buffer) return;
  const title = clean(buffer.title);
  const body = clean(buffer.body);
  if (title) {
    const id = topicIdFor(title);
    if (seenIds.has(id)) {
      console.warn(`build-topics: duplicate title — id collision for "${title}"`);
    }
    seenIds.add(id);
    topics.push({ id, section: currentSection, title, body });
  }
  buffer = null;
}

const seenIds = new Set();

function clean(s) {
  return s
    // strip date trailers like *(Mar 25)* or *(Mar 25, Apr 8)*
    .replace(/\*\([^*]*?\)\*/g, "")
    // strip backticks (inline code) — display as plain text
    .replace(/`([^`]+)`/g, "$1")
    // strip italic markers (single asterisks around words)
    .replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, "$1$2$3")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

const lines = md.split("\n");
for (const raw of lines) {
  const line = raw;
  // Section heading
  if (line.startsWith("## ")) {
    commit();
    // strip leading emoji / non-word chars
    currentSection = line
      .replace(/^## /, "")
      .replace(/^[^A-Za-z]+/, "")
      .trim();
    continue;
  }
  // New bullet — `- **Title.** Body`
  const bullet = /^- \*\*(.+?)\*\*\s*(.*)$/.exec(line);
  if (bullet) {
    commit();
    buffer = { title: bullet[1], body: bullet[2] ?? "" };
    continue;
  }
  // Continuation of current bullet (indented two spaces)
  if (buffer && /^\s{2,}/.test(line) && line.trim() !== "") {
    buffer.body += " " + line.trim();
    continue;
  }
  // Blank line ends a bullet
  if (line.trim() === "") {
    commit();
  }
}
commit();

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, JSON.stringify({ topics }, null, 2) + "\n");
console.log(`build-topics: wrote ${topics.length} topics → ${outPath}`);
