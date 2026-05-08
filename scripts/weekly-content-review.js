/**
 * weekly-content-review.js — Generate the weekly content review digest.
 *
 * Usage: node scripts/weekly-content-review.js
 */

const fs = require('fs');
const path = require('path');

const NOTION_API_KEY = fs.readFileSync(
  path.join(process.env.HOME, '.config/notion/api_key'), 'utf-8'
).trim();
const NOTION_DB_ID = 'bebed412-7c8d-4ed9-881f-fb3aacc8c4f4';
const CALENDAR_PATH = '/Users/openclaw/.openclaw/workspace/gary/content-calendar.md';
const SC_REPORT_PATH = '/Users/openclaw/.openclaw/workspace/gary/research/search-console-weekly.md';
const OUTPUT_PATH = '/Users/openclaw/.openclaw/workspace/gary/weekly-review.md';

async function queryAllAtoms() {
  const allPages = [];
  let cursor = undefined;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion query failed (${res.status}): ${err}`);
    }
    const data = await res.json();
    allPages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return allPages;
}

function extractAtom(page) {
  const props = page.properties;
  return {
    id: page.id,
    text: props['Atom']?.title?.[0]?.plain_text || '',
    sourceSlug: props['Source Slug']?.rich_text?.[0]?.plain_text || '',
    sourceTitle: props['Source Title']?.rich_text?.[0]?.plain_text || '',
    type: props['Type']?.select?.name || '',
    platformFit: (props['Platform Fit']?.multi_select || []).map(s => s.name),
    timesUsed: props['Times Used']?.number || 0,
    lastUsed: props['Last Used']?.date?.start || null,
    status: props['Status']?.select?.name || 'active',
    igPostId: props['Instagram Post ID']?.rich_text?.[0]?.plain_text || '',
    igImpressions: props['Instagram Impressions']?.number || 0,
    igSaves: props['Instagram Saves']?.number || 0,
    liImpressions: props['LinkedIn Impressions']?.number || 0,
    liReactions: props['LinkedIn Reactions']?.number || 0,
    lastEdited: page.last_edited_time || ''
  };
}

function getWeekEndDate() {
  const now = new Date();
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  return now.toLocaleDateString('en-US', options);
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

async function main() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const weekEnd = getWeekEndDate();
  const cutoff = sevenDaysAgo();

  // 1. Query all atoms
  const pages = await queryAllAtoms();
  const allAtoms = pages.map(extractAtom);

  // Atoms used recently (last 7 days based on lastUsed or last_edited_time)
  const recentlyUsed = allAtoms.filter(a =>
    (a.lastUsed && a.lastUsed >= cutoff.slice(0, 10)) ||
    (a.timesUsed > 0 && a.lastEdited >= cutoff)
  );

  // 2. Read content calendar
  let calendarText = '';
  if (fs.existsSync(CALENDAR_PATH)) {
    calendarText = fs.readFileSync(CALENDAR_PATH, 'utf-8');
  }

  // 3. Read search console report if exists
  let scReport = '';
  if (fs.existsSync(SC_REPORT_PATH)) {
    scReport = fs.readFileSync(SC_REPORT_PATH, 'utf-8');
  }

  // Stats
  const totalAtoms = allAtoms.length;
  const unusedAtoms = allAtoms.filter(a => a.timesUsed === 0 && a.status !== 'retired').length;
  const starredAtoms = allAtoms.filter(a => a.status === 'starred').length;
  const sourceSlugs = new Set(allAtoms.map(a => a.sourceSlug).filter(Boolean));

  // Top Instagram posts by impressions (this week)
  const igAtoms = allAtoms
    .filter(a => a.igImpressions > 0)
    .sort((a, b) => b.igImpressions - a.igImpressions)
    .slice(0, 3);

  // Recommendations (reuse plan-content logic: starred first, then unused)
  const candidates = allAtoms
    .filter(a => a.status !== 'retired')
    .sort((a, b) => {
      if (a.status === 'starred' && b.status !== 'starred') return -1;
      if (b.status === 'starred' && a.status !== 'starred') return 1;
      return a.timesUsed - b.timesUsed;
    })
    .slice(0, 3);

  // Build published this week table
  let publishedTable = `| Date | Format | Source | Atom preview | IG Impressions | IG Saves | LI Impressions | LI Reactions |
|---|---|---|---|---|---|---|---|
`;
  const liUpdateLines = [];
  for (const atom of recentlyUsed) {
    const date = formatShortDate(atom.lastUsed || atom.lastEdited);
    const format = atom.platformFit[0] || 'Unknown';
    const preview = atom.text.length > 40 ? `"${atom.text.slice(0, 40)}..."` : `"${atom.text}"`;
    const igImp = atom.igImpressions || '—';
    const igSav = atom.igSaves || '—';
    const liImp = atom.liImpressions || '(enter manually)';
    const liReact = atom.liReactions || '(enter manually)';
    publishedTable += `| ${date} | ${format} | ${atom.sourceSlug} | ${preview} | ${igImp} | ${igSav} | ${liImp} | ${liReact} |\n`;
    liUpdateLines.push(`LI_UPDATE: ${atom.id} impressions=X reactions=Y`);
  }

  if (recentlyUsed.length === 0) {
    publishedTable += `| — | — | — | No atoms used this week | — | — | — | — |\n`;
  }

  // Build the review
  let review = `# Weekly Content Review — ${weekEnd}
Generated: ${now}

## Published this week
${publishedTable}
*LinkedIn numbers: paste below for Hugo to sync to Notion*
\`\`\`
${liUpdateLines.length > 0 ? liUpdateLines.join('\n') : '# No atoms published this week'}
\`\`\`

## Atom inventory snapshot
- Total atoms in DB: ${totalAtoms}
- Unused: ${unusedAtoms}
- Starred: ${starredAtoms}
- Sources covered: ${sourceSlugs.size} blog post${sourceSlugs.size !== 1 ? 's' : ''}

## What performed (Instagram, auto-pulled)
`;

  if (igAtoms.length > 0) {
    for (const a of igAtoms) {
      review += `- "${a.text.slice(0, 60)}..." — ${a.igImpressions} impressions, ${a.igSaves} saves\n`;
    }
  } else {
    review += `No Instagram performance data this week\n`;
  }

  review += `\n## Search traction this week\n`;
  if (scReport) {
    // Extract top queries from the SC report (look for table rows)
    const scLines = scReport.split('\n');
    let found = 0;
    for (const line of scLines) {
      if (found >= 3) break;
      if (line.startsWith('|') && !line.startsWith('| Query') && !line.startsWith('|---') && !line.startsWith('| Page')) {
        review += line + '\n';
        found++;
      }
    }
    if (found === 0) review += `See ${SC_REPORT_PATH} for full report\n`;
  } else {
    review += `No search console report available this week\n`;
  }

  review += `\n## Recommendations for next week\n`;
  for (const atom of candidates) {
    const reason = atom.status === 'starred' ? 'starred by Bene' : atom.timesUsed === 0 ? 'unused atom' : 'low usage';
    review += `- **${atom.sourceSlug}** (${atom.type}): "${atom.text.slice(0, 60)}..." — ${reason}\n`;
  }
  if (candidates.length === 0) {
    review += `No recommendations — run extract-atoms.js on recent posts first\n`;
  }

  // Write and print
  fs.writeFileSync(OUTPUT_PATH, review.trim() + '\n');
  console.log(review.trim());

  // Print LI_UPDATE section clearly
  if (liUpdateLines.length > 0) {
    console.log('\n--- LI_UPDATE (paste LinkedIn numbers here) ---');
    for (const line of liUpdateLines) {
      console.log(line);
    }
  }

  console.log(`\nReview written to ${OUTPUT_PATH}`);
}

main();
