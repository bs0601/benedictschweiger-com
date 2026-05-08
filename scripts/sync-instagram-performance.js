/**
 * sync-instagram-performance.js — Pull Instagram post insights and update
 * the Notion Content Library with performance metrics.
 *
 * Usage: node scripts/sync-instagram-performance.js
 */

const fs = require('fs');
const path = require('path');

const NOTION_API_KEY = fs.readFileSync(
  path.join(process.env.HOME, '.config/notion/api_key'), 'utf-8'
).trim();
const CONTENT_LIBRARY_DB_ID = 'd426a4e3-5e0f-4d92-8db2-23ed8de5f61d';
const CREDS_PATH = path.join(process.env.HOME, '.openclaw/workspace/memory/credentials.env');

function loadCredentials() {
  const raw = fs.readFileSync(CREDS_PATH, 'utf-8');
  const creds = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cleaned = trimmed.replace(/^export\s+/, '');
    const eqIdx = cleaned.indexOf('=');
    if (eqIdx === -1) continue;
    creds[cleaned.slice(0, eqIdx).trim()] = cleaned.slice(eqIdx + 1).trim();
  }
  return creds;
}

async function queryPublishedInstagramRows() {
  const allPages = [];
  let cursor = undefined;
  do {
    const body = {
      page_size: 100,
      filter: {
        and: [
          { property: 'Platform', select: { equals: 'Instagram' } },
          { property: 'Status', select: { equals: 'Published' } }
        ]
      }
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
      throw new Error(`Notion query failed (${res.status}): ${err}`);
    }
    const data = await res.json();
    allPages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return allPages;
}

function extractLibraryRow(page) {
  const props = page.properties;
  return {
    id: page.id,
    name: props['Name']?.title?.[0]?.plain_text || '',
    publishedUrl: props['Published URL']?.url || props['Published URL']?.rich_text?.[0]?.plain_text || '',
    igPostId: props['Instagram Post ID']?.rich_text?.[0]?.plain_text || '',
    igImpressions: props['Instagram Impressions']?.number || 0,
    igSaves: props['Instagram Saves']?.number || 0
  };
}

async function fetchInsightsForPost(postId, token) {
  const url = `https://graph.facebook.com/v21.0/${postId}/insights?metric=impressions,reach,saved&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const metrics = {};
  for (const entry of (data.data || [])) {
    metrics[entry.name] = entry.values?.[0]?.value || 0;
  }
  return metrics;
}

async function fetchRecentMedia(accountId, token) {
  const url = `https://graph.facebook.com/v21.0/${accountId}/media?fields=id,caption,timestamp,media_type,permalink&limit=50&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Instagram media fetch failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.data || [];
}

async function updateLibraryRow(pageId, impressions, saves) {
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
    console.error(`Failed to update ${pageId}: ${err}`);
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

  // 1. Get all published Instagram rows from Content Library
  console.log('Querying Content Library for published Instagram entries...');
  const pages = await queryPublishedInstagramRows();
  const rows = pages.map(extractLibraryRow);
  console.log(`Found ${rows.length} published Instagram entries`);

  if (rows.length === 0) {
    console.log('Nothing to sync.');
    return;
  }

  // 2. Fetch recent media from IG to build a permalink→id lookup
  console.log('Fetching recent Instagram media...');
  const media = await fetchRecentMedia(accountId, token);
  const permalinkToId = {};
  for (const m of media) {
    if (m.permalink) permalinkToId[m.permalink] = m.id;
  }
  console.log(`Fetched ${media.length} recent posts from Instagram`);

  // 3. For each Content Library row, resolve the IG post ID and pull insights
  let updated = 0;
  for (const row of rows) {
    let igId = row.igPostId;

    // Try to resolve from Published URL if no explicit IG Post ID
    if (!igId && row.publishedUrl) {
      igId = permalinkToId[row.publishedUrl] || '';
    }

    if (!igId) {
      console.log(`  Skipped: "${row.name}" — no IG post ID or matching permalink`);
      continue;
    }

    const insights = await fetchInsightsForPost(igId, token);
    if (!insights) {
      console.log(`  Skipped: "${row.name}" — could not fetch insights`);
      continue;
    }

    const impressions = insights.impressions || 0;
    const saves = insights.saved || 0;

    const ok = await updateLibraryRow(row.id, impressions, saves);
    if (ok) {
      console.log(`  Updated: "${row.name}" — ${impressions} impressions, ${saves} saves`);
      updated++;
    }
  }

  console.log(`\nSync complete: ${updated} Content Library row(s) updated with Instagram metrics`);
}

main();
