/**
 * add-pending.js — adds an item to the review queue stored in Netlify Blobs.
 *
 * POST /.netlify/functions/add-pending
 * Body: { secret: "...", item: { slug, title, type, ... } }
 *
 * Also accepts action="remove" to delete a slug from the queue.
 * Also accepts action="seed" with items[] to bulk-load initial data.
 */

const { getStore } = require('@netlify/blobs');

const STORE = 'review-pending';
const KEY   = 'items';

exports.handler = async function(event) {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const secret = process.env.REVIEW_SECRET;
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (secret && body.secret !== secret) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // Ping — return immediately without touching Blobs
  if (action === 'ping') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, pong: true }) };
  }

  const store = getStore(STORE);

  // Load current items
  let items = [];
  try {
    const raw = await store.get(KEY);
    if (raw) items = JSON.parse(raw);
  } catch (e) {
    console.error('Blobs read error:', e.message);
  }

  const action = body.action || 'add';

  if (action === 'seed') {
    // Bulk replace
    items = body.items || [];
    await store.set(KEY, JSON.stringify(items));
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count: items.length }) };
  }

  if (action === 'remove') {
    items = items.filter(i => i.slug !== body.slug);
    await store.set(KEY, JSON.stringify(items));
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count: items.length }) };
  }

  // action === 'add' (default)
  if (!body.item || !body.item.slug) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'item.slug required' }) };
  }

  // Replace if slug already exists, otherwise append
  const existing = items.findIndex(i => i.slug === body.item.slug);
  if (existing >= 0) {
    items[existing] = body.item;
  } else {
    items.push(body.item);
  }

  await store.set(KEY, JSON.stringify(items));
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count: items.length }) };
};
