#!/usr/bin/env node
/**
 * generate-og-image.js — creates a branded OG image for a blog post.
 *
 * Usage: node scripts/generate-og-image.js "Post Title" "Pillar Name" content/blog/slug.md
 */

const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

const title     = process.argv[2];
const pillar    = process.argv[3];
const mdPath    = process.argv[4];

if (!title || !pillar || !mdPath) {
  console.error('Usage: node scripts/generate-og-image.js "Title" "Pillar" content/blog/slug.md');
  process.exit(1);
}

const slug    = path.basename(mdPath, '.md');
const outDir  = path.join(__dirname, '..', 'static', 'images', 'blog');
const outPath = path.join(outDir, `${slug}-og.png`);

// Ensure output directory exists
fs.mkdirSync(outDir, { recursive: true });

// Canvas setup
const W = 1200;
const H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#0f0f0f';
ctx.fillRect(0, 0, W, H);

// Left accent bar
ctx.fillStyle = '#e07428';
ctx.fillRect(0, 0, 6, H);

// Top-left: site name
ctx.fillStyle = '#888888';
ctx.font = '22px sans-serif';
ctx.fillText('Benedict Schweiger', 80, 80);

// Center: post title (word-wrapped, max 2 lines)
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 52px sans-serif';

const maxWidth = 1040;
const lineHeight = 64;
const titleWords = title.split(' ');
const titleLines = [];
let currentLine = '';

for (const word of titleWords) {
  const test = currentLine ? `${currentLine} ${word}` : word;
  if (ctx.measureText(test).width > maxWidth && currentLine) {
    titleLines.push(currentLine);
    currentLine = word;
  } else {
    currentLine = test;
  }
}
if (currentLine) titleLines.push(currentLine);

// Limit to 2 lines, truncate with ellipsis if needed
if (titleLines.length > 2) {
  titleLines.length = 2;
  titleLines[1] = titleLines[1].replace(/\s+\S*$/, '') + '…';
}

const totalTextHeight = titleLines.length * lineHeight;
const startY = 315 - totalTextHeight / 2 + lineHeight * 0.35;

for (let i = 0; i < titleLines.length; i++) {
  ctx.fillText(titleLines[i], 80, startY + i * lineHeight);
}

// Bottom-left: pillar name
ctx.fillStyle = '#888888';
ctx.font = '16px sans-serif';
ctx.fillText(pillar, 80, 570);

// Bottom-right: site URL
ctx.fillStyle = '#555555';
ctx.font = '16px sans-serif';
const urlText = 'benedictschweiger.com';
const urlWidth = ctx.measureText(urlText).width;
ctx.fillText(urlText, 1120 - urlWidth, 570);

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outPath, buffer);
console.log(outPath);
