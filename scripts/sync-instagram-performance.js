/**
 * sync-instagram-performance.js — Pull Instagram post insights and update
 * the Notion Content Atoms database with performance metrics.
 *
 * Usage: node scripts/sync-instagram-performance.js
 */

const fs = require('fs');
const path = require('path');

const NOTION_API_KEY = fs.readFileSync(
  path.join(process.env.HOME, '.config/notion/api_key'), 'utf-8'
).trim();
const NOTION_DB_ID = 'bebed412-7c8d-4ed9-881f-fb3aacc8c4f4';
const CREDS_PATH = '/Users/openclaw/.openclaw/workspace/memory/credentials.env';

function loadCredentials() {
  const raw = fs.readFileSync(CREDS_PATH, 'utf-8');
  const creds = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Strip 'export ' prefix
    const cleaned = trimmed.replace(/^export\s+/, '');
    const eqIdx = cleaned.indexOf('=');
    if (eqIdx === -1) continue;
    const key = cleaned.slice(0, eqIdx).trim();
    const val = cleaned.slice(eqIdx + 1).trim();
    creds[key] = val;
  }
  return creds;
}

async function fetchRecentMedia(accountId, token) {
  const url = `https://graph.facebook.com/v21.0/${accountId}/media?fields=id,caption,timestamp,media_type,permalink&limit=20&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Instagram media fetch failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.data || [];
}

async function fetchInsights(postId, token) {
  const url = `https://graph.facebook.com/v21.0/${postId}/insights?metric=impressions,reach,saved&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    // Some media types don't support insights (e.g., stories)
    return null;
  }
  const data = await res.json();
  const metrics = {};
  for (const entry of (data.data || [])) {
    metrics[entry.name] = entry.values?.[0]?.value || 0;
  }
  return metrics;
}

async function queryAtomsByInstagramPostId(postId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        property: 'Instagram Post ID',
        rich_text: { equals: postId }
      }
    })
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

async function updateAtomMetrics(pageId, impressions, saves) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        'Instagram Impressions': { number: impressions },
        'Instagram Saves': { number: saves }
      }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to update atom ${pageId}: ${err}`);
    return false;
  }
  return true;
}

async function main() {
  const creds = loadCredentials();
  const token = creds.INSTAGRAM_GRAPH_API_TOKEN || creds.META_SYSTEM_USER_TOKEN;
  const accountId = creds.INSTAGRAM_ACCOUNT_ID;

  if (!token || token === 'PENDING') {
    console.warn('Instagram API token not configured. Exiting.');
    process.exit(0);
  }
  if (!accountId) {
    console.warn('INSTAGRAM_ACCOUNT_ID not set. Exiting.');
    process.exit(0);
  }

  console.log('Fetching recent Instagram media...');
  const media = await fetchRecentMedia(accountId, token);
  console.log(`Found ${media.length} recent posts`);

  let updated = 0;
  for (const post of media) {
    const insights = await fetchInsights(post.id, token);
    if (!insights) continue;

    const atoms = await queryAtomsByInstagramPostId(post.id);
    if (atoms.length === 0) continue;

    const impressions = insights.impressions || 0;
    const saves = insights.saved || 0;

    for (const atom of atoms) {
      const ok = await updateAtomMetrics(atom.id, impressions, saves);
      if (ok) {
        const atomText = atom.properties?.['Atom']?.title?.[0]?.plain_text || '(unknown)';
        console.log(`  Updated: "${atomText.slice(0, 50)}..." — ${impressions} impressions, ${saves} saves`);
        updated++;
      }
    }
  }

  console.log(`\nSync complete: ${updated} atom(s) updated with Instagram metrics`);
}

main();
