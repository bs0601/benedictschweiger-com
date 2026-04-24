exports.handler = async function(event) {
  const { code, error } = event.queryStringParameters || {};
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const REDIRECT_URI = 'https://benedictschweiger.com/.netlify/functions/oauth-callback';

  if (error) {
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' },
      body: `<h2 style="font-family:sans-serif;padding:40px;color:red">Error: ${error}</h2>` };
  }
  if (!code) {
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' },
      body: `<p style="font-family:sans-serif;padding:40px">No code. Params: ${JSON.stringify(event.queryStringParameters)}</p>` };
  }

  const params = new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  const tokens = await res.json();

  if (tokens.error) {
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' },
      body: `<h2 style="font-family:sans-serif;padding:40px;color:red">Token error: ${tokens.error} — ${tokens.error_description}</h2>` };
  }

  return { statusCode: 200, headers: { 'Content-Type': 'text/html' },
    body: `<html><body style="font-family:sans-serif;padding:40px;max-width:600px">
      <h2>✅ Done! Copy this and send it to Hugo.</h2>
      <textarea style="width:100%;height:120px;font-size:12px;padding:10px">${tokens.refresh_token}</textarea>
      <p style="color:#888;font-size:13px">Copy it now — this page won't work again.</p>
      </body></html>` };
};
