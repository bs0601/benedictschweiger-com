/**
 * review-auth.js — Netlify Edge Function
 * Guards all /review/* routes. Redirects unauthenticated requests to /review/login/.
 * Uses a SHA-256 token derived from REVIEW_PASSWORD stored in env vars.
 */

export default async function handler(request, context) {
  const url = new URL(request.url);

  // Allow login page and login function through without auth check
  if (
    url.pathname === '/review/login/' ||
    url.pathname === '/review/login' ||
    url.pathname.startsWith('/.netlify/functions/review-login')
  ) {
    return context.next();
  }

  const password = Deno.env.get('REVIEW_PASSWORD');
  if (!password) return context.next(); // Not configured — open access (dev mode)

  const expected = await sha256(password + 'review-salt-2026');
  const cookies  = request.headers.get('cookie') || '';
  const token    = cookies.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('review_auth='))
    ?.split('=')[1];

  if (token !== expected) {
    const loginUrl = new URL('/review/login/', url.origin);
    loginUrl.searchParams.set('next', url.pathname);
    return Response.redirect(loginUrl.toString(), 302);
  }

  return context.next();
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const config = { path: '/review/*' };
