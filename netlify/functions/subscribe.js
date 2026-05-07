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

  // Support both homepage form {email, firstName} and diagnostic {email, name}
  const email = (body.email || "").trim();
  let firstName = body.firstName || body.name || "";
  if (firstName.includes(" ")) firstName = firstName.split(" ")[0];

  if (!email || !email.includes("@")) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid email" }) };
  }

  // Base attributes
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
    // Q labels — support both old (q1/q4/q8/q12/q14) and new (q1–q7) indices
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

    // Compute weakest dimension for Brevo automation branching
    const dimScores = { CO: body.score_co, IE: body.score_ie, GA: body.score_ga };
    const defined = Object.entries(dimScores).filter(([,v]) => v !== undefined && v !== null && v !== "");
    if (defined.length > 0) {
      const weakest = defined.reduce((a, b) => Number(a[1]) <= Number(b[1]) ? a : b);
      attributes.WEAKEST_DIM = weakest[0]; // 'CO', 'IE', or 'GA'
    }
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
      listIds: [8],
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

  // Send welcome email for /resources signups (not diagnostic)
  const source = (body.source || "").toLowerCase();
  const isResourcesSignup = !body.score && source !== "autonomy-score";
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
    }).catch(() => {}); // fire-and-forget, don't fail the signup if email fails
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
