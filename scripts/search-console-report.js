#!/usr/bin/env node
/**
 * search-console-report.js — pulls Search Console data and writes a weekly brief.
 *
 * Usage: node scripts/search-console-report.js
 */

const fs   = require('fs');
const path = require('path');

const CRED_PATH = '/Users/openclaw/.openclaw/workspace/memory/credentials.env';
const OUT_PATH  = '/Users/openclaw/.openclaw/workspace/gary/research/search-console-weekly.md';
const SITE_URL  = 'https://www.benedictschweiger.com/';
const API_BASE  = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;

function loadCredentials() {
  const raw = fs.readFileSync(CRED_PATH, 'utf-8');
  const vars = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) vars[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return vars;
}

async function refreshToken(creds) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     creds.GOOGLE_CLIENT_ID,
      client_secret: creds.GOOGLE_CLIENT_SECRET,
      refresh_token: creds.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token'
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function querySearchConsole(accessToken, dimensions, rowLimit) {
  const endDate   = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 28);

  const fmt = d => d.toISOString().slice(0, 10);

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startDate:  fmt(startDate),
      endDate:    fmt(endDate),
      dimensions,
      rowLimit
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Search Console query failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return { rows: data.rows || [], startDate: fmt(startDate), endDate: fmt(endDate) };
}

function fmtCtr(ctr) {
  return (ctr * 100).toFixed(1) + '%';
}

function fmtPos(pos) {
  return pos.toFixed(1);
}

function buildMarkdown(queryData, pageData, startDate, endDate) {
  const now = new Date().toISOString();
  let md = `# Search Console Brief — ${startDate} to ${endDate}\nGenerated: ${now}\n\n`;

  // Top Queries
  md += '## Top Queries (last 28 days)\n';
  md += '| Query | Clicks | Impressions | CTR | Avg Position |\n';
  md += '|-------|--------|-------------|-----|-------------|\n';
  for (const row of queryData.rows) {
    md += `| ${row.keys[0]} | ${row.clicks} | ${row.impressions} | ${fmtCtr(row.ctr)} | ${fmtPos(row.position)} |\n`;
  }

  md += '\n## Top Pages (last 28 days)\n';
  md += '| Page | Clicks | Impressions | CTR | Avg Position |\n';
  md += '|------|--------|-------------|-----|-------------|\n';
  for (const row of pageData.rows) {
    const pagePath = row.keys[0].replace(SITE_URL.replace(/\/$/, ''), '');
    md += `| ${pagePath} | ${row.clicks} | ${row.impressions} | ${fmtCtr(row.ctr)} | ${fmtPos(row.position)} |\n`;
  }

  // Opportunities
  md += '\n## Opportunities\n';

  const lowCtr = queryData.rows.filter(r => r.impressions > 50 && r.ctr < 0.03);
  const strikingDistance = queryData.rows.filter(r => r.position >= 8 && r.position <= 15);

  if (lowCtr.length > 0) {
    md += '\n**High impressions, low CTR (>50 imp, <3% CTR):**\n';
    for (const r of lowCtr) {
      md += `- "${r.keys[0]}" — ${r.impressions} imp, ${fmtCtr(r.ctr)} CTR, pos ${fmtPos(r.position)}\n`;
    }
  }

  if (strikingDistance.length > 0) {
    md += '\n**Striking distance (position 8–15):**\n';
    for (const r of strikingDistance) {
      md += `- "${r.keys[0]}" — pos ${fmtPos(r.position)}, ${r.clicks} clicks, ${r.impressions} imp\n`;
    }
  }

  if (lowCtr.length === 0 && strikingDistance.length === 0) {
    md += '\nNo clear opportunities detected this period.\n';
  }

  md += '\n## Instructions for Gary\n';
  md += 'Read this before keyword research. Cross-reference with DataForSEO to find keywords where the site already has traction.\n';

  return md;
}

async function main() {
  const creds = loadCredentials();
  const accessToken = await refreshToken(creds);

  const [queryData, pageData] = await Promise.all([
    querySearchConsole(accessToken, ['query'], 50),
    querySearchConsole(accessToken, ['page'], 20)
  ]);

  const md = buildMarkdown(queryData, pageData, queryData.startDate, queryData.endDate);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, md);
  console.log(`Written: ${OUT_PATH}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
