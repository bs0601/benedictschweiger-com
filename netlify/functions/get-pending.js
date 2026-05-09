/**
 * get-pending.js — returns pending review items.
 *
 * GET /.netlify/functions/get-pending
 *
 * Reads /review-queue.json (static, public CDN file) — the single source of truth.
 * No Netlify Blobs. Items are removed from this file directly on approve/delete.
 */

const crypto = require('crypto');

function isAuthorized(event) {
  const password = process.env.REVIEW_PASSWORD;
  if (!password) return true;
  const expected = crypto.createHash('sha256').update(password + 'review-salt-2026').digest('hex');
  const cookies = event.headers.cookie || '';
  return cookies.split(';').some(c => c.trim() === `review_auth=${expected}`);
}

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  if (!isAuthorized(event)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const res = await fetch('https://www.benedictschweiger.com/review-queue.json', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) throw new Error(`Failed to fetch queue: ${res.status}`);
    const items = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify(items) };
  } catch (e) {
    console.error('get-pending error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
