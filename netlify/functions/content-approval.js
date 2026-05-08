/**
 * content-approval.js — handles approve/revise/delete decisions from the review UI.
 *
 * POST body: { action: "approve"|"revise"|"delete", slug, type, feedback }
 *
 * approve — flips draft:true → false via GitHub API (triggers Netlify build + publish)
 *           marks slug as dismissed in Blobs (removes from review dashboard)
 *           sends Telegram confirmation to Bene
 * revise  — sends Telegram + Brevo email with feedback notes
 * delete  — silently removes from pipeline, no notification
 *
 * Required env vars:
 *   GARY_TELEGRAM_BOT_TOKEN, BENE_TELEGRAM_CHAT_ID, BREVO_API_KEY
 *   GITHUB_TOKEN — PAT with repo write access (Settings → Developer settings → PAT)
 */

const { getStore } = require('@netlify/blobs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = 'bs0601/benedictschweiger-com';

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

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { action, slug, type, feedback } = body;

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

  // For approve: publish the draft via GitHub API
  let publishResult = null;
  if (action === 'approve') {
    try {
      publishResult = await publishDraft(slug);
    } catch (e) {
      console.error('publishDraft error:', e.message);
      publishResult = { error: e.message };
    }
  }

  // Build Telegram message
  let text;
  if (action === 'approve') {
    const pubStatus = publishResult?.published
      ? '\n🚀 Published — Netlify build triggered.'
      : publishResult?.alreadyPublished
        ? '\n✓ Already live.'
        : `\n⚠️ Auto-publish failed: ${publishResult?.error}\nManual publish required.`;
    text = `✅ APPROVED\nType: ${type || 'unknown'}\nSlug: ${slug}${pubStatus}`;
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
    body: JSON.stringify({ ok: true, action, slug, publishResult })
  };
};
