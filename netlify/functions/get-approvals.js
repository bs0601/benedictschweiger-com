/**
 * get-approvals.js — Hugo polls this to check for pending approval decisions.
 *
 * GET  /.netlify/functions/get-approvals  → returns queue, leaves it intact
 * POST /.netlify/functions/get-approvals  → returns queue AND clears it
 */

exports.handler = async function(event) {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("approvals");

    const existing = await store.get("queue", { type: "json" }).catch(() => []);
    const items = Array.isArray(existing) ? existing : [];

    // POST = read + clear
    if (event.httpMethod === "POST") {
      await store.setJSON("queue", []);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pending: items.length, items })
    };
  } catch(e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message })
    };
  }
};
