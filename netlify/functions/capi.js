// netlify/functions/capi.js
// Server-side relay for funnel measurement. The client (/start/, /training/)
// fires the browser pixel AND posts the same event here with a shared event_id,
// so Meta + GA4 can deduplicate the browser and server copies.
//
// Contract (from the page <script>):
//   POST { event_name, event_id, event_source_url, ...params }
//   params may include: content_name, value, currency, percent
//
// Fails silently and always returns 200 so a measurement problem never blocks
// the visitor or surfaces an error on the page.
//
// Required Netlify env vars (set in Site settings -> Environment, NOT in code):
//   META_PIXEL_ID        Meta dataset / pixel id (numeric)
//   META_CAPI_TOKEN      Conversions API access token
//   GA4_MEASUREMENT_ID   e.g. G-XXXXXXXXXX
//   GA4_API_SECRET       GA4 Measurement Protocol API secret
// Optional:
//   META_TEST_EVENT_CODE while validating in Events Manager -> Test events

const crypto = require("crypto");

const ok = () => ({ statusCode: 200, body: JSON.stringify({ success: true }) });

const sha256 = (v) =>
  v ? crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex") : undefined;

// Map our internal event names to GA4 event names (mirror of the page's track()).
const GA4_NAME = {
  PageView: "page_view",
  Lead: "generate_lead",
  ViewContent: "view_item",
  VideoProgress: "video_progress",
  InitiateCheckout: "begin_checkout",
};

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return undefined;
  const m = cookieHeader.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : undefined;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return ok(); // never error back to the page
  }

  const eventName = body.event_name;
  const eventId = body.event_id;
  const sourceUrl = body.event_source_url || "";
  if (!eventName || !eventId) return ok();

  const headers = event.headers || {};
  const clientIp =
    headers["x-nf-client-connection-ip"] ||
    headers["client-ip"] ||
    headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    undefined;
  const userAgent = headers["user-agent"] || undefined;
  const cookie = headers["cookie"] || headers["Cookie"];
  const fbp = readCookie(cookie, "_fbp");
  const fbc = readCookie(cookie, "_fbc");

  const eventTime = Math.floor(Date.now() / 1000);

  // Custom params passed through from the page.
  const custom = {};
  if (body.content_name) custom.content_name = body.content_name;
  if (body.value !== undefined) custom.value = body.value;
  if (body.currency) custom.currency = body.currency;
  if (body.percent !== undefined) custom.percent = body.percent;

  const tasks = [];

  // -- Meta Conversions API ---------------------------------------------
  if (process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN) {
    const userData = {};
    if (clientIp) userData.client_ip_address = clientIp;
    if (userAgent) userData.client_user_agent = userAgent;
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;
    if (body.email) userData.em = [sha256(body.email)]; // only if a page ever sends it

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: eventTime,
          event_id: eventId,
          action_source: "website",
          event_source_url: sourceUrl,
          user_data: userData,
          custom_data: custom,
        },
      ],
    };
    if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

    const url =
      "https://graph.facebook.com/v19.0/" +
      process.env.META_PIXEL_ID +
      "/events?access_token=" +
      encodeURIComponent(process.env.META_CAPI_TOKEN);

    tasks.push(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {})
    );
  }

  // -- GA4 Measurement Protocol -----------------------------------------
  if (process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET) {
    // Stable pseudo client_id from fbp, or a hash of ip+ua, so MP has an identifier.
    const clientId =
      fbp ||
      (clientIp && userAgent
        ? crypto.createHash("md5").update(clientIp + userAgent).digest("hex")
        : crypto.randomUUID());

    const ga4Params = { ...custom, event_id: eventId };
    if (sourceUrl) ga4Params.page_location = sourceUrl;
    ga4Params.engagement_time_msec = 1;

    const url =
      "https://www.google-analytics.com/mp/collect?measurement_id=" +
      encodeURIComponent(process.env.GA4_MEASUREMENT_ID) +
      "&api_secret=" +
      encodeURIComponent(process.env.GA4_API_SECRET);

    tasks.push(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          events: [{ name: GA4_NAME[eventName] || "custom_event", params: ga4Params }],
        }),
      }).catch(() => {})
    );
  }

  await Promise.allSettled(tasks);
  return ok();
};
