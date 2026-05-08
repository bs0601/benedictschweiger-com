#!/usr/bin/env node
/**
 * validate-post.js — Gary runs this before committing any blog post.
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
if (draft !== 'true') {
  errors.push(`draft must be "true" before approval (found: "${draft || 'missing'}")`);
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
    warnings.push('cover.image: still using og-default.png — generate a post-specific image');
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

// ── Report ────────────────────────────────────────────────────────────────
const pad = s => `  ${s}`;

if (errors.length === 0 && warnings.length === 0) {
  console.log(`✅  ${path.basename(filePath)} — frontmatter valid`);
  process.exit(0);
}

if (warnings.length > 0) {
  console.log('⚠️   Warnings:');
  warnings.forEach(w => console.log(pad(w)));
}

if (errors.length > 0) {
  console.log('❌  Errors (must fix before commit):');
  errors.forEach(e => console.log(pad(e)));
  console.log('');
  console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(`⚠️   ${warnings.length} warning(s) — no blocking errors`);
process.exit(0);
