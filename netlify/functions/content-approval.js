/**
 * content-approval.js — handles approve/revise decisions from the review UI.
 *
 * POST body: { action: "approve"|"revise", slug, type, feedback }
 *
 * 1. Sends confirmation to Bene via Gary bot (UX confirmation)
 * 2. Writes decision to Netlify Blobs so Hugo can poll and act on it
 */

const TELEGRAM_BOT_TOKEN = process.env.GARY_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.BENE_TELEGRAM_CHAT_ID;

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

  // Step 2: Write to Netlify Blobs queue
  let queued = false;
  let queueError = null;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("approvals");
    const existing = await store.get("queue", { type: "json" }).catch(() => []);
    const queue = Array.isArray(existing) ? existing : [];
    queue.push({ action, slug, type, feedback, timestamp: new Date().toISOString() });
    await store.setJSON("queue", queue);
    queued = true;
  } catch(e) {
    console.error("Blobs write failed:", e.message);
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
