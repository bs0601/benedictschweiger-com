/**
 * weekly-content-review.js — Generate the weekly content review digest
 * from Content Library + Content Atoms.
 *
 * Usage: node scripts/weekly-content-review.js
 */

const fs = require('fs');
const path = require('path');

const NOTION_API_KEY = fs.readFileSync(
  path.join(process.env.HOME, '.config/notion/api_key'), 'utf-8'
).trim();
const CONTENT_LIBRARY_DB_ID = 'd426a4e3-5e0f-4d92-8db2-23ed8de5f61d';
const ATOMS_DB_ID = 'bebed412-7c8d-4ed9-881f-fb3aacc8c4f4';
const OUTPUT_PATH = path.join(__dirname, '..', 'gary', 'weekly-review.md');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function notionQuery(dbId, filter) {
  const allPages = [];
  let cursor = undefined;
  do {
    const body = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
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

function extractLibraryRow(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: p['Name']?.title?.[0]?.plain_text || '',
    platform: p['Platform']?.select?.name || '',
    format: p['Format']?.select?.name || '',
    atomId: p['Atom ID']?.rich_text?.[0]?.plain_text || '',
    status: p['Status']?.select?.name || '',
    publishDate: p['Publish Date']?.date?.start || '',
    publishedUrl: p['Published URL']?.url || p['Published URL']?.rich_text?.[0]?.plain_text || '',
    liImpressions: p['LinkedIn Impressions']?.number || 0,
    liReactions: p['LinkedIn Reactions']?.number || 0,
    igImpressions: p['Instagram Impressions']?.number || 0,
    igSaves: p['Instagram Saves']?.number || 0
  };
}

function extractAtom(page) {
  const p = page.properties;
  return {
    id: page.id,
    text: p['Atom']?.title?.[0]?.plain_text || '',
    sourceSlug: p['Source Slug']?.rich_text?.[0]?.plain_text || '',
    type: p['Type']?.select?.name || '',
    platformFit: (p['Platform Fit']?.multi_select || []).map(s => s.name),
    timesUsed: p['Times Used']?.number || 0,
    status: p['Status']?.select?.name || 'active'
  };
}

function formatPlatformSuggestion(atom) {
  if (atom.platformFit.includes('Carousel')) return 'Carousel';
  if (atom.platformFit.includes('Instagram')) return 'Instagram';
  return 'LinkedIn text';
}

async function main() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const weekEnd = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const cutoff7 = daysAgo(7);
  const cutoff30 = daysAgo(30);

  // 1. Query Content Library — published in last 7 days
  const recentPages = await notionQuery(CONTENT_LIBRARY_DB_ID, {
    and: [
      { property: 'Status', select: { equals: 'Published' } },
      { property: 'Publish Date', date: { on_or_after: cutoff7 } }
    ]
  });
  const recentRows = recentPages.map(extractLibraryRow);

  // 2. Query Content Library — published in last 30 days (for top performers)
  const last30Pages = await notionQuery(CONTENT_LIBRARY_DB_ID, {
    and: [
      { property: 'Status', select: { equals: 'Published' } },
      { property: 'Publish Date', date: { on_or_after: cutoff30 } }
    ]
  });
  const last30Rows = last30Pages.map(extractLibraryRow);

  // 3. Query Content Atoms — unused and starred
  const atomPages = await notionQuery(ATOMS_DB_ID);
  const allAtoms = atomPages.map(extractAtom);
  const unusedAtoms = allAtoms.filter(a => a.timesUsed === 0 && a.status !== 'retired');
  const starredAtoms = allAtoms.filter(a => a.status === 'starred');

  // --- Build digest ---

  // Section 1: Last 7 days
  let review = `# Weekly Content Review — ${weekEnd}
Generated: ${now}

## Last 7 days

`;

  if (recentRows.length > 0) {
    review += `| Date | Name | Platform | Format | Atom ID | LI Imp | LI React | IG Imp | IG Saves |
|---|---|---|---|---|---|---|---|---|
`;
    for (const r of recentRows) {
      review += `| ${formatDate(r.publishDate)} | ${r.name} | ${r.platform} | ${r.format} | ${r.atomId || '—'} | ${r.liImpressions || '—'} | ${r.liReactions || '—'} | ${r.igImpressions || '—'} | ${r.igSaves || '—'} |\n`;
    }
  } else {
    review += `No content published in the last 7 days.\n`;
  }

  // Section 2: Top performers (last 30 days)
  review += `\n## Top performers (last 30 days)\n\n`;

  const withPerformance = last30Rows.filter(r =>
    r.liImpressions > 0 || r.igImpressions > 0
  );

  if (withPerformance.length > 0) {
    const sorted = [...withPerformance].sort((a, b) => {
      const aScore = a.liImpressions + a.igImpressions;
      const bScore = b.liImpressions + b.igImpressions;
      return bScore - aScore;
    }).slice(0, 5);

    for (const r of sorted) {
      const metrics = [];
      if (r.liImpressions) metrics.push(`${r.liImpressions} LI impressions`);
      if (r.liReactions) metrics.push(`${r.liReactions} LI reactions`);
      if (r.igImpressions) metrics.push(`${r.igImpressions} IG impressions`);
      if (r.igSaves) metrics.push(`${r.igSaves} IG saves`);
      review += `- **${r.name}** (${r.platform}, ${r.format}) — ${metrics.join(', ')}\n`;
    }
  } else {
    review += `No performance data available yet for the last 30 days.\n`;
  }

  // Section 3: Recommended next
  review += `\n## Recommended next\n\n`;

  // Merge starred + unused, deduplicate, pick top 5
  const seen = new Set();
  const candidates = [];
  for (const a of [...starredAtoms, ...unusedAtoms]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    candidates.push(a);
    if (candidates.length >= 5) break;
  }

  if (candidates.length > 0) {
    for (const a of candidates) {
      const reason = a.status === 'starred' ? 'starred' : 'unused';
      const format = formatPlatformSuggestion(a);
      review += `- **${a.sourceSlug}** (${a.type}): "${a.text.length > 60 ? a.text.slice(0, 60) + '...' : a.text}" — ${reason}, suggested format: ${format}\n`;
    }
  } else {
    review += `No unused or starred atoms available. Run extract-atoms.js on recent posts.\n`;
  }

  // Write to file
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, review.trim() + '\n');
  console.log(review.trim());
  console.log(`\nReview written to ${OUTPUT_PATH}`);
}

main();
