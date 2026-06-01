exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  // ── HONEYPOT CHECK ──
  // Bots fill hidden fields; humans don't. Reject silently (200 OK) so bots don't retry.
  if (body.website || body.url || body.company || body.phone) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // ── SIMPLE RATE LIMITING ──
  // Use Netlify's request IP. In production this is in event.headers['x-nf-client-connection-ip']
  // or event.headers['client-ip']. Fall back to a hash of the email if no IP.
  const clientIp = event.headers['x-nf-client-connection-ip'] ||
                   event.headers['client-ip'] ||
                   event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   'unknown';
  const rateLimitKey = `rate_limit_${clientIp}`;
  const now = Date.now();

  // In-memory rate limit (resets on cold start, good enough for basic bot protection)
  if (!global.rateLimitStore) global.rateLimitStore = {};
  const store = global.rateLimitStore;

  if (store[rateLimitKey]) {
    const { count, windowStart } = store[rateLimitKey];
    if (now - windowStart < 3600000) { // 1 hour window
      if (count >= 3) {
        return { statusCode: 429, body: JSON.stringify({ error: "Too many requests. Try again later." }) };
      }
      store[rateLimitKey].count = count + 1;
    } else {
      store[rateLimitKey] = { count: 1, windowStart: now };
    }
  } else {
    store[rateLimitKey] = { count: 1, windowStart: now };
  }

  // ── EMAIL VALIDATION ──
  const email = (body.email || "").trim();
  let firstName = body.firstName || body.name || "";
  if (firstName.includes(" ")) firstName = firstName.split(" ")[0];

  if (!email || !email.includes("@")) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid email" }) };
  }

  // Block obvious disposable/bot domains
  const blockedDomains = [
    'tempmail.com', 'throwaway.com', 'guerrillamail.com',
    'mailinator.com', 'yopmail.com', 'sharklasers.com'
  ];
  const domain = email.split('@')[1]?.toLowerCase();
  if (blockedDomains.includes(domain)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid email" }) };
  }

  // ── ATTRIBUTES ──
  const attributes = { FIRSTNAME: firstName };
  if (body.source) attributes.SOURCE = body.source;
  if (body.utm_source)   attributes.UTM_SOURCE   = body.utm_source;
  if (body.utm_medium)   attributes.UTM_MEDIUM   = body.utm_medium;
  if (body.utm_campaign) attributes.UTM_CAMPAIGN = body.utm_campaign;
  if (body.utm_content)  attributes.UTM_CONTENT  = body.utm_content;

  // Diagnostic attributes — only set if this is a diagnostic submission
  if (body.score !== undefined) {
    attributes.SCORE      = body.score;
    attributes.ZONE       = body.zone       || "";
    attributes.SCORE_CO   = body.score_co   ?? "";
    attributes.SCORE_IE   = body.score_ie   ?? "";
    attributes.SCORE_GA   = body.score_ga   ?? "";
    if (body.q1_label)        attributes.Q1_LABEL        = body.q1_label;
    if (body.q2_label)        attributes.Q2_LABEL        = body.q2_label;
    if (body.q3_label)        attributes.Q3_LABEL        = body.q3_label;
    if (body.q4_label)        attributes.Q4_LABEL        = body.q4_label;
    if (body.q5_label)        attributes.Q5_LABEL        = body.q5_label;
    if (body.q6_label)        attributes.Q6_LABEL        = body.q6_label;
    if (body.q7_label)        attributes.Q7_LABEL        = body.q7_label;
    if (body.q8_label)        attributes.Q8_LABEL        = body.q8_label;
    if (body.q12_label)       attributes.Q12_LABEL       = body.q12_label;
    if (body.q14_label)       attributes.Q14_LABEL       = body.q14_label;
    if (body.biggest_obstacle) attributes.BIGGEST_OBSTACLE = body.biggest_obstacle;
    if (body.magic_wand)      attributes.MAGIC_WAND      = body.magic_wand;
    if (body.revenue)         attributes.REVENUE         = body.revenue;
    if (body.adspend)         attributes.ADSPEND         = body.adspend;
    if (body.aov)             attributes.AOV             = body.aov;
    if (body.margin)          attributes.MARGIN          = body.margin;
    if (body.mer)             attributes.MER             = body.mer;
    if (body.adspend_share)   attributes.ADSPEND_SHARE   = body.adspend_share;
    if (body.cost_per_order)  attributes.COST_PER_ORDER  = body.cost_per_order;
    if (body.newsletter_optin !== undefined) attributes.NEWSLETTER_OPTIN = body.newsletter_optin ? "Yes" : "No";

    const dimScores = { CO: body.score_co, IE: body.score_ie, GA: body.score_ga };
    const defined = Object.entries(dimScores).filter(([,v]) => v !== undefined && v !== null && v !== "");
    if (defined.length > 0) {
      const weakest = defined.reduce((a, b) => Number(a[1]) <= Number(b[1]) ? a : b);
      attributes.WEAKEST_DIM = weakest[0];
    }
  }

  // ── LIST ASSIGNMENT ──
  let listIds = [8]; // Default: newsletter
  if (body.score !== undefined) {
    listIds = [8, 9]; // Diagnostic completions
  } else if (body.source === "workbook-signup") {
    listIds = [11]; // Workbook — Margin Method
  } else if (body.source === "waitlist") {
    listIds = [10]; // Test Stand waitlist
  }

  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      attributes,
      listIds,
      updateEnabled: true
    })
  });

  const isSuccess = res.status === 201 || res.status === 204;
  if (!isSuccess) {
    const err = await res.json().catch(() => ({}));
    if (err.code !== "duplicate_parameter") {
      return { statusCode: 500, body: JSON.stringify({ error: "Subscription failed" }) };
    }
  }

  // Send welcome email for /resources signups (not diagnostic or waitlist)
  const source = body.source || "";
  const isResourcesSignup = !body.score && source !== "autonomy-score" && source !== "waitlist" && source !== "workbook-signup";
  if (isResourcesSignup) {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        templateId: 45,
        to: [{ email, name: firstName || email }]
      })
    }).catch(() => {});
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
