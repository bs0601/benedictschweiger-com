# Change brief — Meta Pixel + CAPI wiring (2026-06-16)

For **Hugo / OpenClaw**. From the content engine (Producer). Supplements steps **5–6** of `CHANGE-BRIEF-2026-06-15-funnel-go-live.md` — read that first. This is the "fill the measurement placeholders" work, now that a dedicated Meta dataset exists.

**Do not re-implement from Meta's wizard.** `netlify/functions/capi.js` already relays server-side events to Meta CAPI + GA4 and dedups against the browser pixel on the shared `event_id`. The Meta "send instructions to your developer" / "implement manually" guide is redundant given that function exists — skip it. The only work here is wiring IDs + secrets into the existing setup.

---

## Facts captured this session (credential setup, by Bene)

A **new, dedicated Meta dataset for benedictschweiger.com** was created (the old `ToplineXperts Pixel 1398345037939545` is a different property — do not use it).

- **New Pixel / Dataset ID: `1031340199571007`** — this is `REPLACE_META_PIXEL_ID` / `META_PIXEL_ID`. The browser base code is already minted for it (`fbq('init','1031340199571007')` + PageView).
- **CAPI configured in Events Manager** for these events: **CompleteRegistration** (free-training signup), **InitiateCheckout** (Stripe checkout start), **Purchase** ($27 recording).
- **Customer-info params selected:** email (must be **SHA-256 hashed server-side** before send), `fbc`, `fbp`, client IP. **Purchase** also carries **value + currency**. This matches what `capi.js` already reads (IP / user-agent / `_fbp` / `_fbc`, dedup on `event_id`).

⚠ **Duplicate dataset exists.** Meta's wizard spawned a second `benedictschweiger.com` dataset, **`917458874697273`** (0 events, no integrations). Keep **`1031340199571007`** (the code references it); the duplicate should be deleted to avoid split data / broken dedup. **Deletion is Bene's call** — flag it, don't act.

---

## To do (Hugo / OpenClaw)

1. **Set `META_PIXEL_ID = 1031340199571007`** in Netlify env, and replace `REPLACE_META_PIXEL_ID` in the `MM` config block on `/start/` and `/training/`.
2. **Set `META_CAPI_TOKEN`** in Netlify env once the token exists (see blocker below). Without it, `capi.js` no-ops; with it, browser + server events dedup on `event_id`.
3. **Verify `capi.js` event mapping** covers CompleteRegistration / InitiateCheckout / Purchase, and that `value` + `currency` (USD) pass on Purchase.
4. **Confirm consent gating** — pixel and CAPI must fire only **after cookie consent** (GDPR), and email must be hashed before send. Cross-check against the `/datenschutz/` disclosures.
5. **Test:** Meta Events Manager → Test events (optional `META_TEST_EVENT_CODE`) + GA4 Realtime → confirm the deduped events land. Smoke-test alongside the `/start/` → `/training/` flow from the go-live brief.

---

## Blocker only Bene can clear — generate the CAPI token

The **`META_CAPI_TOKEN` is not yet generated.** Whoever holds Business/Events Manager access on *BM Schweiger Assessoria LTDA* must mint it (it is **shown once**):

> Events Manager → dataset **benedictschweiger.com (`1031340199571007`)** → **Einstellungen** → **Conversions API** → **Zugriffsschlüssel generieren** → copy.

Hand it to OpenClaw to set as the `META_CAPI_TOKEN` Netlify env var — **not into chat, the repo, or git.** If Hugo doesn't have Meta access, he can't self-serve this; it has to come from Bene.

---

## Still outstanding from the same credential session (not in this brief)

- **GA4:** Measurement ID (`REPLACE_GA4_ID` / `GA4_MEASUREMENT_ID`) + Measurement Protocol API secret (`GA4_API_SECRET`).
- **Stripe webhook signing secret** — for the fulfillment wiring in step 8 of the go-live brief (Stripe → Brevo).

These are being collected separately and will land as env vars per step 6 of the `2026-06-15` brief.
