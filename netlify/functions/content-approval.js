/**
 * content-approval.js — handles approve/revise/delete decisions from the review UI.
 *
 * POST body: { action: "approve"|"revise"|"delete", slug, type, feedback }
 *
 * approve — flips draft:true → false in content/blog/{slug}.md via GitHub API
 *           removes slug from static/review-queue.json via GitHub API
 *           submits URL to Google Indexing API
 *           flips matching Notion atoms to source_live
 *           sends Telegram confirmation
 * revise  — sends Telegram + Brevo email with feedback, no queue change
 * delete  — removes slug from static/review-queue.json silently, no publish
 *
 * Queue management (for scripts):
 *   queue-add    { secret, item }         — upsert item into queue
 *   queue-remove { secret, slug }         — remove slug from queue
 *   queue-get    { secret }               — return current queue
 *
 * Required env vars:
 *   GARY_TELEGRAM_BOT_TOKEN, BENE_TELEGRAM_CHAT_ID, BREVO_API_KEY
 *   GITHUB_TOKEN            — GitHub PAT with repo write access
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   NOTION_API_KEY          — Notion integration token (atoms DB tracking)
 *   REVIEW_PASSWORD         — dashboard auth
 */

const crypto = require('crypto');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = 'bs0601/benedictschweiger-com';
const SITE_BASE    = 'https://www.benedictschweiger.com';
const QUEUE_PATH   = 'static/review-queue.json';

const TELEGRAM_BOT_TOKEN = process.env.GARY_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.BENE_TELEGRAM_CHAT_ID;
const BREVO_API_KEY      = process.env.BREVO_API_KEY;
const NOTION_API_KEY     = process.env.NOTION_API_KEY;
const NOTION_ATOMS_DB_ID = 'bebed412-7c8d-4ed9-881f-fb3aacc8c4f4';

function isAuthorized(event) {
  const password = process.env.REVIEW_PASSWORD;
  if (!password) return true;
  const expected = crypto.createHash('sha256').update(password + 'review-salt-2026').digest('hex');
  const cookies = event.headers.cookie || '';
  return cookies.split(';').some(c => c.trim() === `review_auth=${expected}`);
}

function isBodyAuthorized(body) {
  const password = process.env.REVIEW_PASSWORD;
  if (!password) return true;
  return body.secret === password;
}

// --- GitHub helpers ---

const GH_HEADERS = {
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json'
};

async function ghGet(path) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, { headers: GH_HEADERS });
  if (!res.ok) throw new Error(`GitHub GET ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function ghPut(path, content, sha, message) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: GH_HEADERS,
    body: JSON.stringify({ message, content: Buffer.from(content).toString('base64'), sha })
  });
  if (!res.ok) throw new Error(`GitHub PUT ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// --- Queue management ---

async function readQueue() {
  const file = await ghGet(QUEUE_PATH);
  const items = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));
  return { items, sha: file.sha };
}

async function writeQueue(items, sha, message) {
  const content = JSON.stringify(items, null, 2) + '\n';
  return ghPut(QUEUE_PATH, content, sha, message);
}

async function removeFromQueue(slug) {
  const { items, sha } = await readQueue();
  const filtered = items.filter(i => i.slug !== slug);
  if (filtered.length === items.length) return { unchanged: true };
  await writeQueue(filtered, sha, `review: remove ${slug} from queue`);
  return { removed: true, remaining: filtered.length };
}

async function addToQueue(item) {
  const { items, sha } = await readQueue();
  const idx = items.findIndex(i => i.slug === item.slug);
  if (idx >= 0) items[idx] = item; else items.push(item);
  await writeQueue(items, sha, `review: add ${item.slug} to queue`);
  return { ok: true, count: items.length };
}

// --- Google Indexing API ---

async function getGoogleAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token'
    }).toString()
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function requestGoogleIndexing(postUrl) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return { skipped: true, reason: 'no refresh token' };
  }
  const token = await getGoogleAccessToken();
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: postUrl, type: 'URL_UPDATED' })
  });
  if (!res.ok) throw new Error(`Indexing API error (${res.status}): ${await res.text()}`);
  return res.json();
}

// --- Blog publishing ---

async function publishDraft(slug) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set');
  const filePath = `content/blog/${slug}.md`;
  const file = await ghGet(filePath);
  const current = Buffer.from(file.content, 'base64').toString('utf-8');
  if (!current.includes('draft: true') && !current.includes('draft:true')) {
    return { alreadyPublished: true };
  }
  const updated = current
    .replace(/^draft:\s*true/m, 'draft: false')
    .replace(/^draft:true/m, 'draft: false');
  await ghPut(filePath, updated, file.sha, `Publish: ${slug}`);
  return { published: true };
}

// --- Notion atom tracking ---

async function markAtomsSourceLive(slug) {
  if (!NOTION_API_KEY) return { skipped: true };
  const headers = {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };
  const queryRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_ATOMS_DB_ID}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ filter: { property: 'Source Slug', rich_text: { equals: slug } } })
  });
  if (!queryRes.ok) throw new Error(`Notion query failed (${queryRes.status}): ${await queryRes.text()}`);
  const data = await queryRes.json();
  let updated = 0;
  for (const page of data.results) {
    if (page.properties?.Status?.select?.name !== 'active') continue;
    await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ properties: { Status: { select: { name: 'source_live' } } } })
    });
    updated++;
  }
  return { updated, total: data.results.length };
}

// --- Main handler ---

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { action, slug, type, feedback } = body;

  // Queue management endpoints — body secret or cookie auth
  if (['queue-add', 'queue-remove', 'queue-get'].includes(action)) {
    if (!isAuthorized(event) && !isBodyAuthorized(body)) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    try {
      if (action === 'queue-get') {
        const { items } = await readQueue();
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) };
      }
      if (action === 'queue-add') {
        if (!body.item?.slug) return { statusCode: 400, body: JSON.stringify({ error: 'item.slug required' }) };
        const result = await addToQueue(body.item);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
      }
      if (action === 'queue-remove') {
        if (!slug) return { statusCode: 400, body: JSON.stringify({ error: 'slug required' }) };
        const result = await removeFromQueue(slug);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
      }
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }

  // approve / revise / delete — cookie auth only
  if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!action || !slug) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing action or slug' }) };
  }

  const respHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  // Delete — remove from queue silently
  if (action === 'delete') {
    try { await removeFromQueue(slug); } catch (e) { console.error('removeFromQueue error:', e.message); }
    return { statusCode: 200, headers: respHeaders, body: JSON.stringify({ ok: true, action, slug }) };
  }

  if (action !== 'approve' && action !== 'revise') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  }

  let publishResult = null, indexResult = null, atomResult = null, queueResult = null;

  if (action === 'approve') {
    // 1. Publish the draft
    try { publishResult = await publishDraft(slug); }
    catch (e) { publishResult = { error: e.message }; }

    // 2. Remove from queue
    try { queueResult = await removeFromQueue(slug); }
    catch (e) { console.error('removeFromQueue error (non-fatal):', e.message); }

    // 3. Mark atoms source_live
    if (type === 'blog' && publishResult?.published) {
      try { atomResult = await markAtomsSourceLive(slug); }
      catch (e) { atomResult = { error: e.message }; }
    }

    // 4. Google Indexing
    try { indexResult = await requestGoogleIndexing(`${SITE_BASE}/blog/${slug}/`); }
    catch (e) { indexResult = { error: e.message }; }
  }

  // Build Telegram message
  let text;
  if (action === 'approve') {
    const pubStatus = publishResult?.published ? '🚀 Netlify build triggered'
      : publishResult?.alreadyPublished ? '✓ Already live'
      : `⚠️ Publish failed: ${publishResult?.error}`;
    const idxStatus = indexResult?.skipped ? '⏳ Indexing API not configured'
      : indexResult?.error ? `⚠️ Indexing: ${indexResult.error}`
      : '🔍 Submitted to Google';
    const atomHint = type === 'blog' ? `\n\n💡 Next: \`node scripts/extract-atoms.js content/blog/${slug}.md\`` : '';
    text = `✅ APPROVED\n\nSlug: ${slug}\nType: ${type || 'unknown'}\n\n${pubStatus}\n${idxStatus}\n🔗 ${SITE_BASE}/blog/${slug}/${atomHint}`;
  } else {
    text = `🔄 REVISE\nType: ${type || 'unknown'}\nSlug: ${slug}\n\nFeedback:\n${feedback || '(no feedback provided)'}`;
  }

  // Send Telegram
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
    });
  } catch (e) { console.error('Telegram error:', e.message); }

  // Revise: also email Hugo via Brevo
  if (action === 'revise') {
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'Gary (Content Agent)', email: 'noreply@benedictschweiger.com' },
          to: [{ email: 'info@benedictschweiger.com', name: 'Hugo' }],
          subject: `HUGO_REVISE:${slug}`,
          textContent: JSON.stringify({ action, slug, type, feedback }, null, 2)
        })
      });
    } catch (e) { console.error('Brevo error:', e.message); }
  }

  return {
    statusCode: 200,
    headers: respHeaders,
    body: JSON.stringify({ ok: true, action, slug, publishResult, indexResult, atomResult, queueResult })
  };
};
