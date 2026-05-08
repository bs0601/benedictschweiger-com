/**
 * get-approvals.js — Hugo polls this to check for pending approval decisions.
 *
 * GET  /.netlify/functions/get-approvals         → returns queue, leaves it intact
 * POST /.netlify/functions/get-approvals         → returns queue AND clears it
 */

import { getStore } from '@netlify/blobs';

export const handler = async function(event) {
  const store = getStore('approvals');

  try {
    const queue = await store.get('queue', { type: 'json' }).catch(() => []);
    const items = Array.isArray(queue) ? queue : [];

    // POST = read + clear
    if (event.httpMethod === 'POST') {
      await store.setJSON('queue', []);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pending: items.length, items })
    };
  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
