/**
 * review-login.js — handles login form POST for the review dashboard.
 * POST body: password=xxx (form-encoded)
 * On success: sets review_auth cookie and redirects to /review/ (or ?next=)
 * On failure: redirects back to /review/login/?error=1
 */

const crypto = require('crypto');

exports.handler = async function(event) {
  const REVIEW_PASSWORD = process.env.REVIEW_PASSWORD;

  if (!REVIEW_PASSWORD) {
    return { statusCode: 500, body: 'REVIEW_PASSWORD not configured' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const params   = new URLSearchParams(event.body || '');
  const password = params.get('password') || '';
  const next     = params.get('next') || event.queryStringParameters?.next || '/review/';

  if (password !== REVIEW_PASSWORD) {
    return {
      statusCode: 302,
      headers: { Location: '/review/login/?error=1' },
      body: ''
    };
  }

  // Derive token — same algo as edge function
  const token = crypto
    .createHash('sha256')
    .update(password + 'review-salt-2026')
    .digest('hex');

  return {
    statusCode: 302,
    headers: {
      Location: next,
      // 30 days, Secure, SameSite=Strict — not HttpOnly so edge function can read it
      'Set-Cookie': `review_auth=${token}; Path=/; Secure; SameSite=Strict; Max-Age=2592000`
    },
    body: ''
  };
};
