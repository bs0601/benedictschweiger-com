/**
 * get-pending.js — returns pending review items filtered by dismissed slugs.
 *
 * GET /.netlify/functions/get-pending
 *
 * Reads /review/pending.json from the CDN, checks a Netlify Blob store for
 * dismissed slugs (approved or deleted), and returns the filtered list.
 */

const { getStore } = require('@netlify/blobs');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Fetch the static pending.json from CDN
    const baseUrl = process.env.URL || 'https://www.benedictschweiger.com';
    const res = await fetch(`${baseUrl}/review/pending.json?t=${Date.now()}`);
    if (!res.ok) {
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }
    const items = await res.json();

    // Load dismissed slugs from Blobs
    let dismissed = new Set();
    try {
      const store = getStore('review-dismissed');
      const raw = await store.get('dismissed-slugs');
      if (raw) {
        const parsed = JSON.parse(raw);
        dismissed = new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error('Blobs read error (non-fatal):', e.message);
    }

    const filtered = items.filter(item => !dismissed.has(item.slug));
    return { statusCode: 200, headers, body: JSON.stringify(filtered) };
  } catch (e) {
    console.error('get-pending error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
