// Temporary debug function — delete after use
exports.handler = async function() {
  const cid = process.env.GOOGLE_CLIENT_ID || '';
  const cs  = process.env.GOOGLE_CLIENT_SECRET || '';
  const rt  = process.env.GOOGLE_REFRESH_TOKEN || '';
  const gh  = process.env.GITHUB_TOKEN || '';
  return {
    statusCode: 200,
    body: JSON.stringify({
      CLIENT_ID:     cid ? cid.slice(0,20)+'...' : 'NOT SET',
      CLIENT_SECRET: cs  ? cs.slice(0,10)+'... (len='+cs.length+')' : 'NOT SET',
      REFRESH_TOKEN: rt  ? rt.slice(0,10)+'... (len='+rt.length+')' : 'NOT SET',
      GITHUB_TOKEN:  gh  ? gh.slice(0,10)+'... (len='+gh.length+')' : 'NOT SET',
    })
  };
};
