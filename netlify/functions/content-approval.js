/**
 * content-approval.js — handles approve/revise decisions from the review UI.
 *
 * POST body: { action: "approve"|"revise", slug, type, feedback }
 *
 * 1. Sends confirmation to Bene via Gary bot (UX confirmation)
 * 2. Writes decision to Google Drive queue file so Hugo can act on it
 */

const TELEGRAM_BOT_TOKEN    = process.env.GARY_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID      = process.env.BENE_TELEGRAM_CHAT_ID;
const GOOGLE_CLIENT_ID      = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET  = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN  = process.env.GOOGLE_REFRESH_TOKEN;
// Drive file ID for the approvals queue JSON
const APPROVALS_QUEUE_FILE  = process.env.APPROVALS_QUEUE_FILE_ID;

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

  // Build Telegram message
  let text;
  if (action === "approve") {
    text = `✅ APPROVED\nType: ${type || "unknown"}\nSlug: ${slug}`;
  } else if (action === "revise") {
    text = `🔄 REVISE\nType: ${type || "unknown"}\nSlug: ${slug}\n\nFeedback:\n${feedback || "(no feedback provided)"}`;
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: "Unknown action" }) };
  }

  // Send via Gary bot to Bene's chat
  const tgRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML"
      })
    }
  );

  if (!tgRes.ok) {
    const err = await tgRes.text();
    console.error("Telegram error:", err);
    return { statusCode: 502, body: JSON.stringify({ error: "Telegram delivery failed" }) };
  }

  // Step 2: Write decision to Google Drive queue file
  let driveError = null;
  try {
    await writeToDriveQueue({ action, slug, type, feedback, timestamp: new Date().toISOString() });
  } catch(e) {
    console.error('Drive queue write failed:', e.message);
    driveError = e.message;
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ok: true, action, slug, driveQueued: !driveError, driveError })
  };
};

async function getGoogleAccessToken() {
  const params = `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&client_secret=${encodeURIComponent(GOOGLE_CLIENT_SECRET)}&refresh_token=${encodeURIComponent(GOOGLE_REFRESH_TOKEN)}&grant_type=refresh_token`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get Google token: ' + JSON.stringify(data));
  return data.access_token;
}

async function writeToDriveQueue(decision) {
  const token = await getGoogleAccessToken();

  // Read current queue
  let queue = [];
  if (APPROVALS_QUEUE_FILE) {
    try {
      const readRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${APPROVALS_QUEUE_FILE}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (readRes.ok) queue = await readRes.json();
    } catch(e) { /* start fresh if unreadable */ }
  }

  // Append new decision
  queue.push(decision);

  const body = JSON.stringify(queue, null, 2);
  const fileId = APPROVALS_QUEUE_FILE;

  if (fileId) {
    // Update existing file
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      }
    );
  } else {
    // Create new file (first run — log the ID so we can save it)
    const meta = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'gary-approvals-queue.json', mimeType: 'application/json' })
    });
    const { id } = await meta.json();
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body
      }
    );
    console.log(`APPROVALS_QUEUE_FILE created: ${id} — save this as Netlify env var APPROVALS_QUEUE_FILE_ID`);
  }
}
