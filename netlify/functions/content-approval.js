/**
 * content-approval.js — handles approve/revise/delete decisions from the review UI.
 *
 * POST body: { action: "approve"|"revise"|"delete", slug, type, feedback }
 *
 * approve/delete — marks slug as dismissed in Netlify Blobs (removes from dashboard)
 * approve        — also sends Telegram + Brevo email to Hugo to trigger publish
 * revise         — sends Telegram + Brevo email with feedback
 * delete         — silently removes from pipeline, no notification
 */

const { getStore } = require('@netlify/blobs');

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

  // Build Telegram message
  let text;
  if (action === "approve") {
    text = `✅ APPROVED\nType: ${type || "unknown"}\nSlug: ${slug}`;
  } else if (action === "revise") {
    text = `🔄 REVISE\nType: ${type || "unknown"}\nSlug: ${slug}\n\nFeedback:\n${feedback || "(no feedback provided)"}`;
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: "Unknown action" }) };
  }

  // Step 1: Send Telegram confirmation to Bene
  const tgRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" })
    }
  );

  if (!tgRes.ok) {
    const err = await tgRes.text();
    console.error("Telegram error:", err);
    return { statusCode: 502, body: JSON.stringify({ error: "Telegram delivery failed" }) };
  }

  // Step 2: Send approval decision to Hugo via email (Brevo → Gmail)
  let queued = false;
  let queueError = null;
  try {
    const emailBody = JSON.stringify({ action, slug, type, feedback }, null, 2);
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: 'Gary (Content Agent)', email: 'noreply@benedictschweiger.com' },
        to: [{ email: 'info@benedictschweiger.com', name: 'Hugo' }],
        subject: `HUGO_APPROVAL:${action}:${slug}`,
        textContent: emailBody
      })
    });
    if (brevoRes.ok) {
      queued = true;
    } else {
      const err = await brevoRes.text();
      queueError = `Brevo error: ${err}`;
      console.error(queueError);
    }
  } catch(e) {
    console.error('Email queue failed:', e.message);
    queueError = e.message;
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ok: true, action, slug, queued, queueError })
  };
};
