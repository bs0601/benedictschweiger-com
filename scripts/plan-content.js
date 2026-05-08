/**
 * plan-content.js — Gary's editorial brain. Reads the Notion atoms DB and
 * content calendar, then recommends what to create next.
 *
 * Usage: node scripts/plan-content.js
 */

const fs = require('fs');
const path = require('path');

const NOTION_API_KEY = fs.readFileSync(
  path.join(process.env.HOME, '.config/notion/api_key'), 'utf-8'
).trim();
const ATOMS_DB_ID = 'bebed412-7c8d-4ed9-881f-fb3aacc8c4f4';
const CONTENT_LIBRARY_DB_ID = 'd426a4e3-5e0f-4d92-8db2-23ed8de5f61d';
const CALENDAR_PATH = '/Users/openclaw/.openclaw/workspace/gary/content-calendar.md';
const OUTPUT_PATH = '/Users/openclaw/.openclaw/workspace/gary/content-plan.md';

async function queryAllAtoms() {
  const allPages = [];
  let cursor = undefined;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${ATOMS_DB_ID}/query`, {
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
    status: props['Status']?.select?.name || 'active'
  };
}

function parseCalendar(calendarText) {
  // Extract table rows from the Queue section
  const lines = calendarText.split('\n');
  const entries = [];
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('| Slug')) { inTable = true; continue; }
    if (line.startsWith('|---')) continue;
    if (inTable && line.startsWith('|')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 3) {
        entries.push({
          slug: cols[0],
          type: cols[1],
          platform: cols[2],
          status: cols[4] || '',
          targetDate: cols[5] || ''
        });
      }
    } else if (inTable && !line.startsWith('|')) {
      break;
    }
  }
  return entries;
}

function formatPlatformSuggestion(atom) {
  if (atom.platformFit.includes('Carousel')) return 'Carousel post';
  if (atom.platformFit.includes('Instagram')) return 'Instagram visual caption';
  return 'LinkedIn text post with quote card';
}

function generateReason(atom) {
  const reasons = [];
  if (atom.status === 'starred') reasons.push('starred by Bene');
  if (atom.timesUsed === 0) reasons.push('unused atom');
  if (atom.type === 'data') reasons.push('data point — high engagement potential');
  if (atom.type === 'provocation') reasons.push('contrarian angle — drives comments');
  if (atom.type === 'quote') reasons.push('quotable — strong for cards');
  if (reasons.length === 0) reasons.push('fresh content opportunity');
  return reasons.join(', ');
}

async function queryContentLibrary() {
  const allPages = [];
  let cursor = undefined;
  do {
    const body = {
      page_size: 100,
      filter: { property: 'Status', select: { equals: 'Published' } }
    };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${CONTENT_LIBRARY_DB_ID}/query`, {
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
      throw new Error(`Content Library query failed (${res.status}): ${err}`);
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
    name: p['Name']?.title?.[0]?.plain_text || '',
    platform: p['Platform']?.select?.name || '',
    format: p['Format']?.select?.name || '',
    atomId: p['Atom ID']?.rich_text?.[0]?.plain_text || '',
    liImpressions: p['LinkedIn Impressions']?.number || 0,
    liReactions: p['LinkedIn Reactions']?.number || 0,
    igImpressions: p['Instagram Impressions']?.number || 0,
    igSaves: p['Instagram Saves']?.number || 0
  };
}

async function main() {
  // 1. Query all atoms
  const pages = await queryAllAtoms();
  const allAtoms = pages.map(extractAtom);
  const atoms = allAtoms.filter(a => a.status !== 'retired');

  // 2. Read content calendar
  let calendarEntries = [];
  let calendarText = '';
  if (fs.existsSync(CALENDAR_PATH)) {
    calendarText = fs.readFileSync(CALENDAR_PATH, 'utf-8');
    calendarEntries = parseCalendar(calendarText);
  }

  // 3. Group atoms
  const bySource = {};
  const byType = {};
  const byPlatform = {};
  for (const a of atoms) {
    if (!bySource[a.sourceSlug]) bySource[a.sourceSlug] = [];
    bySource[a.sourceSlug].push(a);
    if (!byType[a.type]) byType[a.type] = [];
    byType[a.type].push(a);
    for (const p of a.platformFit) {
      if (!byPlatform[p]) byPlatform[p] = [];
      byPlatform[p].push(a);
    }
  }

  // 4. Generate recommendations
  // Priority: starred > unused > least used
  const candidates = [...atoms].sort((a, b) => {
    if (a.status === 'starred' && b.status !== 'starred') return -1;
    if (b.status === 'starred' && a.status !== 'starred') return 1;
    return a.timesUsed - b.timesUsed;
  });

  // Check recent calendar formats for balance
  const recentFormats = calendarEntries
    .filter(e => e.status === 'live' || e.status === 'approved')
    .slice(-5)
    .map(e => e.type);
  const recentLinkedIn = recentFormats.filter(t => t === 'linkedin' || t === 'blog').length;
  const recentCarousel = recentFormats.filter(t => t === 'carousel').length;
  const recentInstagram = recentFormats.filter(t => t === 'instagram').length;

  // Pick top 5 recommendations, mixing formats
  const recommendations = [];
  const used = new Set();
  for (const atom of candidates) {
    if (recommendations.length >= 5) break;
    if (used.has(atom.text)) continue;
    used.add(atom.text);
    recommendations.push(atom);
  }

  // 5. Build output
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const activeCount = atoms.filter(a => a.status === 'active').length;
  const starredCount = atoms.filter(a => a.status === 'starred').length;

  let plan = `# Content Plan
Generated: ${now}
Atoms in DB: ${allAtoms.length} | Active: ${activeCount} | Starred: ${starredCount}

## Recommended next posts

`;

  recommendations.forEach((atom, i) => {
    plan += `### ${i + 1}. ${atom.sourceSlug} — ${atom.type}
**Atom:** ${atom.text}
**Format:** ${formatPlatformSuggestion(atom)}
**Why:** ${generateReason(atom)}
**Platform fit:** ${atom.platformFit.join(', ')}

`;
  });

  // Atom inventory by source
  plan += `## Atom inventory by source
| Source | Total atoms | Unused | Starred |
|---|---|---|---|
`;
  for (const [slug, slugAtoms] of Object.entries(bySource)) {
    const unused = slugAtoms.filter(a => a.timesUsed === 0).length;
    const starred = slugAtoms.filter(a => a.status === 'starred').length;
    plan += `| ${slug} | ${slugAtoms.length} | ${unused} | ${starred} |\n`;
  }

  // Platform balance
  const linkedInCount = calendarEntries.filter(e => e.type === 'linkedin' || e.platform?.includes('LinkedIn')).length;
  const carouselCount = calendarEntries.filter(e => e.type === 'carousel').length;
  const instagramCount = calendarEntries.filter(e => e.type === 'instagram' || e.platform?.includes('Instagram')).length;

  plan += `
## Platform balance (last 30 days)
Based on calendar: ${linkedInCount} LinkedIn text, ${carouselCount} carousels, ${instagramCount} Instagram
`;

  if (carouselCount === 0) {
    plan += `Recommendation: Carousels are underrepresented — consider a carousel next\n`;
  } else if (instagramCount === 0) {
    plan += `Recommendation: Instagram is underrepresented — consider an Instagram post next\n`;
  } else if (linkedInCount < 3) {
    plan += `Recommendation: LinkedIn text posts are below target — prioritize LinkedIn\n`;
  } else {
    plan += `Recommendation: Good balance — continue current mix\n`;
  }

  // 6. Performance insights from Content Library (grouped by Atom ID)
  let libraryRows = [];
  try {
    const libPages = await queryContentLibrary();
    libraryRows = libPages.map(extractLibraryRow).filter(r => r.atomId);
  } catch (err) {
    console.error(`Warning: Could not query Content Library: ${err.message}`);
  }

  if (libraryRows.length > 0) {
    const byAtomId = {};
    for (const r of libraryRows) {
      if (!byAtomId[r.atomId]) byAtomId[r.atomId] = [];
      byAtomId[r.atomId].push(r);
    }

    plan += `\n## Performance insights\n\nContent Library entries grouped by Atom ID — shows which atoms have been used and their best-performing format.\n\n`;
    plan += `| Atom ID (short) | Uses | Best format | Best platform | Top impressions |\n|---|---|---|---|---|\n`;

    for (const [atomId, entries] of Object.entries(byAtomId)) {
      const best = [...entries].sort((a, b) => {
        const aImp = a.liImpressions + a.igImpressions;
        const bImp = b.liImpressions + b.igImpressions;
        return bImp - aImp;
      })[0];
      const topImp = best.liImpressions + best.igImpressions;
      plan += `| ${atomId.slice(0, 8)}... | ${entries.length} | ${best.format || '—'} | ${best.platform || '—'} | ${topImp || '—'} |\n`;
    }
  }

  // Write and print
  fs.writeFileSync(OUTPUT_PATH, plan.trim() + '\n');
  console.log(plan.trim());
  console.log(`\nPlan written to ${OUTPUT_PATH}`);
}

main();
