# Change brief — funnel go-live (2026-06-15)

From the content engine (Producer). Decision locked this session: **ship the /start/ + /training/ funnel first, then scope the from-scratch rebuild as a separate track.** The funnel pages are static and survive a rebuild, so this is not throwaway work.

This brief closes the open items from `CHANGE-BRIEF-2026-06-10-funnel-pages.md`. OpenClaw reviews, sets secrets, and commits/deploys. **Do not edit the funnel page HTML and the content engine at the same time** — these files were just written via studio-fs.

---

## A. Already written into the repo this session (review + commit)

| Path | Change | Status |
|---|---|---|
| `netlify/functions/subscribe.js` | `source:"training-optin"` now routes to **Brevo list 11** (same as workbook-signup) and is excluded from the `/resources` welcome email (templateId 45), so training opt-ins get only the workbook DOI + nurture. | ✅ done |
| `netlify/functions/capi.js` | **New.** Server-side relay to Meta Conversions API + GA4 Measurement Protocol. Dedups against the browser pixel via the shared `event_id`. Reads IP / user-agent / `_fbp` / `_fbc` from request headers. Runs safe with no env vars (does nothing, returns 200). | ✅ done |
| `static/impressum/index.html` | **New.** §5 DDG Impressum. Personal details are clearly-marked placeholders. | ⚠ needs your details + legal review |
| `static/datenschutz/index.html` | **New.** Art. 13 DSGVO privacy policy grounded in the actual stack (Netlify, Brevo, Meta Pixel/CAPI, GA4, YouTube-nocookie, Stripe, Google Fonts). Controller address is a placeholder. | ⚠ needs your details + legal review |

The footers on `/start/` and `/training/` already link to `/impressum/` and `/datenschutz/`, so these now resolve instead of 404ing.

---

## B. Operational wiring — only Bene / OpenClaw (in dependency order)

**Must happen before any ad spend:**

1. **Legal pages — fill the placeholders.** Address, optional phone, USt-IdNr (or delete that section), and the date. Both pages mark every gap in a terracotta highlight. Then have them reviewed — Germany has real Abmahnung risk on Impressum/Datenschutz. *(These are the legal blocker; ads cannot run without them.)*
2. **Upload the headshot.** `static/images/bene-headshot.jpg` is referenced by `/start/` and the existing `/workbook-signup/` page and currently 404s on both.
3. **Brevo DOI.** Confirm list 11 uses double-opt-in; set the confirmation redirect to `https://benedictschweiger.com/training/confirmed/`. **Verify list 11 fires only the new 14-email sequence (`final.md`), not the retired 6-email one** — a double welcome breaks the first impression. *(Highest-risk item.)*
4. **Stripe — DONE 2026-06-15 (live).** Product `prod_Ui4Pb7bBKwRZ1c`, price `price_1TieGiJuRgbQ2egDh95M5mvC` ($27 USD, tax-inclusive), payment link **https://buy.stripe.com/3cIbJ28JobBa5H48GL9ws05**. Replace `REPLACE_STRIPE_27_LINK` in `static/training/index.html` with this URL. ⚠ **Do not promote the link until fulfillment exists** (see new step 8): a hosted confirmation message promises an email that is not yet automated.
5. **Replace the measurement placeholders** in the `MM` config block of both pages: `REPLACE_META_PIXEL_ID`, `REPLACE_GA4_ID`, and on `/training/` also `REPLACE_YOUTUBE_ID` (unlisted video) and confirm `MM.videoAspect` (`"16:9"` or `"9:16"`).
6. **Set Netlify env vars for the CAPI function** (Site settings → Environment): `META_PIXEL_ID`, `META_CAPI_TOKEN`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`. Optional `META_TEST_EVENT_CODE` while validating in Events Manager → Test events. Without these the function no-ops; with them, browser + server events dedup on `event_id`.
8. **Fulfillment for the $27 link (NOT YET BUILT — gates promoting the paid offer).** A buyer currently pays and gets a confirmation message promising an email that nothing sends. Before driving any paid traffic to the offer: (a) confirm the recording asset exists, (b) build a delivery/welcome page (e.g. `/recording/welcome/`), (c) switch the payment link's after_completion from hosted_confirmation to a redirect to that page, and (d) wire Stripe → Brevo so buyers are tagged and the recording is delivered. The free-training funnel (`/start/` → `/training/`) can go live without this; the paid button cannot.

7. **Deploy**, then smoke-test: submit `/start/` with a real address → confirm the Brevo contact lands on list 11 with `SOURCE=training-optin` → click the DOI email → confirm it lands on `/training/` → check Meta Test Events + GA4 Realtime show the deduped events.

---

## C. Open decisions (yours)

- **Currency — RESOLVED 2026-06-15: everything is USD.** The $27 recording on `/training/` is already correct (the page fires `value:27, currency:"USD"`). Knock-on: the existing **live Stripe links are in EUR** (€190 single seat / €690 team, PROJECT-STATUS §8). Stripe cannot change the currency of an existing price, so when the `/margin-os/` page is built those need **new USD prices ($190 / $690)** created and re-linked. Not a funnel blocker — the workshop is not on these pages — but track it so the EUR links don't ship.
- **Google Fonts.** Both new legal pages and the funnel pages load Hanken from Google's CDN, which transmits visitor IPs to Google — a known German GDPR sore point. The font files already exist in the brand system. Recommendation: self-host Hanken before scaling spend, then delete §9 of the Datenschutz. Low urgency, not a launch blocker.

---

## D. Out of scope (deferred, by decision)

The from-scratch website rebuild. Funnel ships on the current site; the rebuild is scoped separately so it stops being a decision with no plan behind it.
