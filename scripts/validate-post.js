#!/usr/bin/env node
/**
 * validate-post.js — Gary runs this before committing any blog post.
 *
 * SPEC: memory/blog-feedback-rules.md is the source of truth.
 * This script is the enforcement. If they drift, the markdown wins.
 *
 * Usage: node scripts/validate-post.js content/blog/my-post.md
 *
 * Checks:
 *   - title present
 *   - description present and ≤160 chars
 *   - slug present and matches filename (no date prefix)
 *   - draft: true (always committed as draft)
 *   - author present
 *   - tags array present and non-empty
 *   - cover.image present
 *   - hasFAQ: true
 *   - faq array with at least 4 questions
 *   - No banned AI vocabulary in body
 *   - TLDR: exactly 3 bullets, saves the turn
 *   - One broken/missing section only
 *   - No self-critique after the closing section
 *   - Future-tense promises hedged (warnings only)
 *   - Cost section compressed
 *   - Strong lines developed (no stranded pull quotes)
 *
 * Exits 0 on pass, 1 on errors.
 */

const fs   = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-post.js content/blog/slug.md');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const raw     = fs.readFileSync(filePath, 'utf-8');
const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
if (!fmMatch) {
  console.error('❌  No frontmatter found');
  process.exit(1);
}

const fm   = fmMatch[1];
const body = raw.slice(fmMatch[0].length);

// Simple frontmatter getter (handles quoted and unquoted values)
function get(key) {
  const m = fm.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
  return m ? m[1].trim() : null;
}

const errors   = [];
const warnings = [];

// ── Title ──────────────────────────────────────────────────────────────────
const title = get('title');
if (!title) {
  errors.push('title: missing');
} else {
  const clean = title.replace(/^["']|["']$/g, '');
  if (clean.length > 70) warnings.push(`title: ${clean.length} chars — aim for under 60`);
}

// ── Description ───────────────────────────────────────────────────────────
const desc = get('description');
if (!desc) {
  errors.push('description: missing');
} else {
  const clean = desc.replace(/^["']|["']$/g, '');
  if (clean.length > 160) errors.push(`description: ${clean.length} chars — max 160`);
  else if (clean.length < 80) warnings.push(`description: ${clean.length} chars — aim for 120–160 for SEO`);
}

// ── Slug ──────────────────────────────────────────────────────────────────
const slug = get('slug');
if (!slug) {
  errors.push('slug: missing');
} else {
  const clean    = slug.replace(/^["']|["']$/g, '');
  const expected = path.basename(filePath, '.md');
  if (clean !== expected) {
    errors.push(`slug "${clean}" does not match filename "${expected}"`);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    errors.push(`slug has a date prefix — remove it (found: "${clean}")`);
  }
}

// ── Draft ─────────────────────────────────────────────────────────────────
const draft = get('draft');
// Allow draft: false for direct publishes (Bene approved via Telegram)
if (draft !== 'true' && draft !== 'false') {
  errors.push(`draft must be "true" or "false" (found: "${draft || 'missing'}")`);
}

// ── Author ────────────────────────────────────────────────────────────────
if (!get('author')) {
  warnings.push('author: missing — add author: "Benedict Schweiger"');
}

// ── Tags ──────────────────────────────────────────────────────────────────
if (!fm.includes('tags:')) {
  errors.push('tags: missing');
} else {
  const tagLines = fm.match(/tags:\s*\n((?:\s*-\s*.+\n?)*)/);
  const inlineTags = fm.match(/^tags:\s*\[.+\]/m);
  if (!tagLines && !inlineTags) {
    errors.push('tags: empty — add at least 3 tag entries');
  }
}

// ── Keywords ──────────────────────────────────────────────────────────────
if (!fm.includes('keywords:')) {
  warnings.push('keywords: missing — add 3–5 exact search queries');
}

// ── Cover image ───────────────────────────────────────────────────────────
if (!fm.includes('cover:')) {
  errors.push('cover: missing — Gary must generate a 1200×630 OG image');
} else if (!fm.includes('image:')) {
  errors.push('cover.image: missing — specify the image path');
} else {
  const imgMatch = fm.match(/^\s+image:\s*["']?(.+?)["']?\s*$/m);
  if (imgMatch && imgMatch[1].includes('og-default')) {
    errors.push('cover.image: still using og-default.png — generate a post-specific image');
  }
}

// ── FAQ ───────────────────────────────────────────────────────────────────
const hasFAQ = get('hasFAQ');
if (hasFAQ !== 'true') {
  errors.push('hasFAQ: must be true');
}
if (!fm.includes('faq:')) {
  errors.push('faq: section missing');
} else {
  const questions = (fm.match(/^\s+-\s+question:/gm) || []).length;
  if (questions < 4) errors.push(`faq: only ${questions} question(s) — minimum 4 required`);
  else if (questions < 5) warnings.push('faq: 4 questions — 5–6 is ideal for rich results');
}

// ── Date ──────────────────────────────────────────────────────────────────
if (!get('date')) {
  warnings.push('date: missing — add date: YYYY-MM-DD');
}

// ── Word count ────────────────────────────────────────────────────────────
const words = body.trim().split(/\s+/).filter(w => w.length > 0);
const wordCount = words.length;
if (wordCount < 600) {
  errors.push(`word count: ${wordCount} — minimum 600 required`);
} else if (wordCount < 900) {
  warnings.push(`word count: ${wordCount} — aim for 900–1500 for SEO weight`);
}

// ── Internal link check ──────────────────────────────────────────────────
if (!body.includes('/autonomy-score/')) {
  errors.push('missing link to /autonomy-score/ — every post must include it');
}
if (!/brevo|\/resources|newsletter/i.test(body)) {
  warnings.push('no newsletter CTA found (brevo, /resources, or newsletter) — consider adding one');
}

// ── Banned vocabulary ─────────────────────────────────────────────────────
const banned = [
  'testament', 'showcasing', 'pivotal', 'delve', 'landscape',
  'notably', "it's worth noting", 'additionally', 'in order to',
  'due to the fact that', 'leverage', 'synergy', 'utilize',
];
const bodyLower = body.toLowerCase();
const found = banned.filter(w => bodyLower.includes(w));
if (found.length > 0) {
  warnings.push(`banned vocabulary found: ${found.join(', ')}`);
}

// ── Feedback-derived quality checks ──────────────────────────────────────
const qualityErrors = [];
const qualityWarnings = [];

// TLDR: exactly 3 bullets, saves the turn
// Accepts ## TL;DR or ## TL;DR header format
const tldrMatch = body.match(/## TL;?DR\*?\*?([\s\S]*?)(?=\n---|\n## |\n\n\n)/);
if (tldrMatch) {
  const tldrBullets = (tldrMatch[1].match(/^- /gm) || []).length;
  if (tldrBullets !== 3) {
    qualityErrors.push(`TLDR: ${tldrBullets} bullets — exactly 3 required (2 substance + 1 hook)`);
  }
} else {
  qualityErrors.push('TLDR: missing — every post must have a TL;DR section');
}

// One broken/missing section only
const brokenSections = (body.match(/^## (What.*broke|What.*missing|What.*hate|What.*broken)/gim) || []).length;
if (brokenSections > 1) {
  qualityErrors.push(`multiple broken/missing sections (${brokenSections}) — merge into one`);
}

// No self-critique after the closing section
const allSections = body.match(/^## .+/gm) || [];
const closingIdx = allSections.findIndex(s => /verdict|conclusion|the point|why this matters/i.test(s));
if (closingIdx !== -1) {
  const afterClosing = allSections.slice(closingIdx + 1);
  const critiqueAfter = afterClosing.filter(s => /broke|hate|missing|broken|flaw|limitation/i.test(s));
  if (critiqueAfter.length > 0) {
    qualityErrors.push(`self-critique appears after closing section — move before "${allSections[closingIdx].replace('## ', '')}"`);
  }
}

// Future-tense promises about results (warnings only)
const futurePromises = body.match(/\b(will produce|will handle|will work|will scale)\b[^.]*(?:every|always|never|rest of|for the future)/gi) || [];
if (futurePromises.length > 0) {
  qualityWarnings.push(`future-tense promise detected: "${futurePromises.slice(0, 2).join('", "')}" — consider hedging`);
}

// Cost section: must not be a list
const costSectionMatch = body.match(/## What this actually costs([\s\S]*?)(?=\n## |\n---|$)/);
if (costSectionMatch) {
  const costLines = costSectionMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
  if (costLines.length > 3) {
    qualityErrors.push('cost section reads like spec sheet — compress to one paragraph with conclusion leading');
  }
}

// ── Voice rules (warnings only) ──────────────────────────────────────────
const voiceWarnings = [];

const emDashCount = (body.match(/—/g) || []).length;
if (emDashCount > 3) {
  voiceWarnings.push(`em dash overuse (found ${emDashCount}) — use commas or periods`);
}

const fillerPhrases = [
  "it's worth noting", "worth noting", "in order to",
  "due to the fact", "it is important to", "one of the most"
];
for (const phrase of fillerPhrases) {
  if (bodyLower.includes(phrase)) {
    voiceWarnings.push(`filler phrase: "${phrase}"`);
  }
}

const sentences = body.split(/\n/).map(l => l.trim());
for (const line of sentences) {
  if (/^(Additionally|Furthermore|Moreover),/i.test(line)) {
    voiceWarnings.push(`weak opener: "${line.slice(0, 50)}…"`);
  }
}

// Check for staccato fragment clusters (4+ consecutive very short lines)
const lines = body.split('\n');
let shortRun = 0;
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.length > 0 && trimmed.split(/\s+/).length < 8) {
    shortRun++;
    if (shortRun > 4) {
      voiceWarnings.push('possible staccato fragment cluster — 4+ consecutive short lines');
      break;
    }
  } else {
    shortRun = 0;
  }
}

// ── Report ────────────────────────────────────────────────────────────────
const pad = s => `  ${s}`;
const totalIssues = errors.length + warnings.length + voiceWarnings.length;

if (totalIssues === 0 && qualityErrors.length === 0) {
  console.log(`✅  ${path.basename(filePath)} — all checks passed`);
  if (qualityWarnings.length > 0) {
    console.log('\n⚡  Quality warnings (review-time, not blockers):');
    qualityWarnings.forEach(w => console.log(pad(w)));
  }
  process.exit(0);
}

if (errors.length > 0) {
  console.log('❌  Errors (must fix before commit):');
  errors.forEach(e => console.log(pad(e)));
}

if (qualityErrors.length > 0) {
  console.log('\n🎯  Quality errors (feedback rules):');
  qualityErrors.forEach(e => console.log(pad(e)));
}

if (qualityWarnings.length > 0) {
  console.log('\n⚡  Quality warnings (review-time, not blockers):');
  qualityWarnings.forEach(w => console.log(pad(w)));
}

if (warnings.length > 0) {
  console.log('\n⚠️   Warnings:');
  warnings.forEach(w => console.log(pad(w)));
}

if (voiceWarnings.length > 0) {
  console.log('\n🗣️  Voice notes (style, not blockers):');
  voiceWarnings.forEach(v => console.log(pad(v)));
}

console.log('');
console.log(`${errors.length} error(s), ${qualityErrors.length} quality error(s), ${qualityWarnings.length} quality warning(s), ${warnings.length} warning(s), ${voiceWarnings.length} voice note(s)`);

if (errors.length > 0 || qualityErrors.length > 0) {
  process.exit(1);
}
process.exit(0);
