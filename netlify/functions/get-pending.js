/**
 * get-pending.js — returns pending review items filtered by dismissed slugs.
 *
 * GET /.netlify/functions/get-pending
 *
 * Reads /review/pending.json from the CDN, checks a Netlify Blob store for
 * dismissed slugs (approved or deleted), and returns the filtered list.
 */

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

function isAuthorized(event) {
  const password = process.env.REVIEW_PASSWORD;
  if (!password) return true; // not configured — open (dev)
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
    // Read pending.json directly from the filesystem (avoids auth guard on /review/*)
    const path = require('path');
    const fs = require('fs');
    const pendingPath = path.join(__dirname, '../../static/review/pending.json');
    if (!fs.existsSync(pendingPath)) {
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }
    const items = JSON.parse(fs.readFileSync(pendingPath, 'utf-8'));

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
