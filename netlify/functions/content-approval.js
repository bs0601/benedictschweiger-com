/**
 * content-approval.js — handles approve/revise decisions from the review UI.
 * 
 * POST body: { action: "approve"|"revise", slug, type, feedback }
 * 
 * Sends a Telegram message to Bene's chat via Gary bot so Hugo can process it.
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

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ok: true, action, slug })
  };
};
