/**
 * content-approval.js — handles approve/revise/delete decisions from the review UI.
 *
 * POST body: { action: "approve"|"revise"|"delete", slug, type, feedback }
 *
 * approve — flips draft:true → false via GitHub API (triggers Netlify build + publish)
 *           submits URL to Google Indexing API for immediate crawling
 *           marks slug as dismissed in Blobs (removes from review dashboard)
 *           sends Telegram confirmation to Bene
 * revise  — sends Telegram + Brevo email with feedback notes
 * delete  — silently removes from pipeline, no notification
 *
 * Required env vars:
 *   GARY_TELEGRAM_BOT_TOKEN, BENE_TELEGRAM_CHAT_ID, BREVO_API_KEY
 *   GITHUB_TOKEN            — GitHub PAT with repo write access
 *   GOOGLE_CLIENT_ID        — already set (used by oauth-callback)
 *   GOOGLE_CLIENT_SECRET    — already set (used by oauth-callback)
 *   GOOGLE_REFRESH_TOKEN    — must include indexing scope (re-auth if needed)
 *   NOTION_API_KEY          — Notion integration token (atoms DB tracking)
 */

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

function isAuthorized(event) {
  const password = process.env.REVIEW_PASSWORD;
  if (!password) return true;
  const expected = crypto.createHash('sha256').update(password + 'review-salt-2026').digest('hex');
  const cookies = event.headers.cookie || '';
  return cookies.split(';').some(c => c.trim() === `review_auth=${expected}`);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = 'bs0601/benedictschweiger-com';
const SITE_BASE    = 'https://www.benedictschweiger.com';

// --- Google Indexing API via existing OAuth user credentials ---
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
  const rt = process.env.GOOGLE_REFRESH_TOKEN;
  if (!rt) {
    console.warn('GOOGLE_REFRESH_TOKEN not set — skipping Indexing API');
    return { skipped: true, reason: 'no refresh token' };
  }

  const token = await getGoogleAccessToken();

  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: postUrl, type: 'URL_UPDATED' })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Indexing API error (${res.status}): ${err}`);
  }
  return await res.json();
}

async function publishDraft(slug) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set');

  const filePath = `content/blog/${slug}.md`;
  const apiUrl   = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
  const headers  = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  // Fetch current file
  const getRes = await fetch(apiUrl, { headers });
  if (!getRes.ok) {
    const err = await getRes.text();
    throw new Error(`GitHub GET failed (${getRes.status}): ${err}`);
  }
  const fileData = await getRes.json();
  const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

  // Flip draft: true → false
  if (!currentContent.includes('draft: true') && !currentContent.includes('draft:true')) {
    // Already published or not a draft — no-op
    return { alreadyPublished: true };
  }
  const updatedContent = currentContent
    .replace(/^draft:\s*true/m, 'draft: false')
    .replace(/^draft:true/m, 'draft: false');

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Publish: ${slug}`,
      content: Buffer.from(updatedContent).toString('base64'),
      sha: fileData.sha
    })
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub PUT failed (${putRes.status}): ${err}`);
  }
  return { published: true };
}

const TELEGRAM_BOT_TOKEN = process.env.GARY_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.BENE_TELEGRAM_CHAT_ID;
const BREVO_API_KEY      = process.env.BREVO_API_KEY;
const NOTION_API_KEY     = process.env.NOTION_API_KEY;
const NOTION_ATOMS_DB_ID = 'bebed412-7c8d-4ed9-881f-fb3aacc8c4f4';

async function markAtomsSourceLive(slug) {
  if (!NOTION_API_KEY) {
    console.warn('NOTION_API_KEY not set — skipping atom status update');
    return { skipped: true };
  }

  const headers = {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  // Query atoms where Source Slug matches
  const queryRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_ATOMS_DB_ID}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filter: {
        property: 'Source Slug',
        rich_text: { equals: slug }
      }
    })
  });

  if (!queryRes.ok) {
    const err = await queryRes.text();
    throw new Error(`Notion query failed (${queryRes.status}): ${err}`);
  }

  const data = await queryRes.json();
  let updated = 0;

  for (const page of data.results) {
    const currentStatus = page.properties?.Status?.select?.name;
    if (currentStatus !== 'active') continue;

    const updateRes = await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        properties: {
          Status: { select: { name: 'source_live' } }
        }
      })
    });

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error(`Notion update failed for ${page.id}: ${err}`);
    } else {
      updated++;
    }
  }

  return { updated, total: data.results.length };
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Parse body first so queue ops can authenticate via body secret
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { action, slug, type, feedback } = body;
  const queueActions = ['queue-seed', 'queue-add', 'queue-remove', 'queue-get'];

  if (queueActions.includes(action)) {
    // Queue ops: accept cookie auth OR body secret
    const pw = process.env.REVIEW_PASSWORD;
    const secretOk = pw ? body.secret === pw : true;
    if (!isAuthorized(event) && !secretOk) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized', debug: { pwSet: !!pw, pwLen: pw ? pw.length : 0, secretLen: body.secret ? body.secret.length : 0 } }) };
    }
  } else if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (queueActions.includes(action)) {
    try {
      const qStore = getStore('review-pending');
      let items = [];
      const raw = await qStore.get('items');
      if (raw) items = JSON.parse(raw);

      if (action === 'queue-get') {
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) };
      }
      if (action === 'queue-seed') {
        items = body.items || [];
        await qStore.set('items', JSON.stringify(items));
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, count: items.length }) };
      }
      if (action === 'queue-add') {
        if (!body.item || !body.item.slug) return { statusCode: 400, body: JSON.stringify({ error: 'item.slug required' }) };
        const idx = items.findIndex(i => i.slug === body.item.slug);
        if (idx >= 0) items[idx] = body.item; else items.push(body.item);
        await qStore.set('items', JSON.stringify(items));
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, count: items.length }) };
      }
      if (action === 'queue-remove') {
        items = items.filter(i => i.slug !== slug);
        await qStore.set('items', JSON.stringify(items));
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, count: items.length }) };
      }
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (!action || !slug) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing action or slug" }) };
  }

  // For approve and delete: mark slug as dismissed in Blobs
  if (action === 'approve' || action === 'delete') {
    try {
      const store = getStore('review-dismissed');
      const raw = await store.get('dismissed-slugs');
      const existing = raw ? JSON.parse(raw) : [];
      if (!existing.includes(slug)) {
        existing.push(slug);
      }
      await store.set('dismissed-slugs', JSON.stringify(existing));
    } catch (e) {
      console.error('Blobs write error (non-fatal):', e.message);
    }
  }

  // Delete is silent — no Telegram/email, just dismiss
  if (action === 'delete') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, action, slug })
    };
  }

  // For approve: publish the draft via GitHub API, then ping Google
  let publishResult = null;
  let indexResult   = null;
  if (action === 'approve') {
    try {
      publishResult = await publishDraft(slug);
    } catch (e) {
      console.error('publishDraft error:', e.message);
      publishResult = { error: e.message };
    }

    // Mark atoms as source_live when a blog post is approved
    let atomResult = null;
    if (type === 'blog' && publishResult?.published) {
      try {
        atomResult = await markAtomsSourceLive(slug);
        console.log('Atom status update:', JSON.stringify(atomResult));
      } catch (e) {
        console.error('Atom status update error (non-fatal):', e.message);
        atomResult = { error: e.message };
      }
    }

    // Request Google indexing (non-blocking — failure doesn't break the flow)
    const postUrl = `${SITE_BASE}/blog/${slug}/`;
    try {
      indexResult = await requestGoogleIndexing(postUrl);
      console.log('Indexing API result:', JSON.stringify(indexResult));
    } catch (e) {
      console.error('Indexing API error (non-fatal):', e.message);
      indexResult = { error: e.message };
    }
  }

  // Build Telegram message
  let text;
  if (action === 'approve') {
    const pubStatus = publishResult?.published
      ? '🚀 Netlify build triggered'
      : publishResult?.alreadyPublished
        ? '✓ Already live'
        : `⚠️ Publish failed: ${publishResult?.error}`;
    const idxStatus = indexResult?.skipped
      ? '⏳ Indexing API not configured'
      : indexResult?.error
        ? `⚠️ Indexing error: ${indexResult.error}`
        : '🔍 Submitted to Google Indexing API';
    const atomHint = (type === 'blog')
      ? `\n\n💡 Next: \`node scripts/extract-atoms.js content/blog/${slug}.md\``
      : '';
    text = `✅ APPROVED\n\nSlug: ${slug}\nType: ${type || 'unknown'}\n\n${pubStatus}\n${idxStatus}\n🔗 ${SITE_BASE}/blog/${slug}/${atomHint}`;
  } else if (action === 'revise') {
    text = `🔄 REVISE\nType: ${type || 'unknown'}\nSlug: ${slug}\n\nFeedback:\n${feedback || '(no feedback provided)'}`;
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  }

  // Send Telegram confirmation to Bene
  const tgRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
    }
  );

  if (!tgRes.ok) {
    const err = await tgRes.text();
    console.error('Telegram error:', err);
    // Non-fatal if publish already succeeded
  }

  // For revise: also email Hugo with feedback
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
    } catch (e) {
      console.error('Brevo revise email failed:', e.message);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, action, slug, publishResult, indexResult, atomResult })
  };
};
