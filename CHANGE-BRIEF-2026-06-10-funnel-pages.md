# Change brief — funnel pages /start/ + /training/ (2026-06-10)

From the content engine (Claude/Producer). Files are already written into this repo; OpenClaw reviews, wires the one function change, and commits/deploys. Nothing else in the repo was touched.

## New files (already in place)

| Path | Job | Tracking on page |
|---|---|---|
| `static/start/index.html` | Ad opt-in landing (email + first name, zero distraction) | PageView; **Lead** on successful submit |
| `static/start/check-inbox/index.html` | DOI "confirm your email" interstitial (noindex) | none |
| `static/training/index.html` | Free training video + $27 recording offer + workbook link (noindex) | **ViewContent** on load; **VideoProgress** 25/50/75/95; **InitiateCheckout** on CTA click |
| `static/training/confirmed/index.html` | Brevo DOI redirect target → forwards to `/training/` (noindex) | none |

Flow: ad → `/start/` (submit → Lead → `/start/check-inbox/`) → DOI email click → `/training/confirmed/` → `/training/` → Stripe.

## Required wiring (OpenClaw / Bene)

1. **subscribe function:** add routing for `source: "training-optin"` → Brevo **list 11** (same contract as `workbook-signup`: `{email, firstName, source, website}` with `website` = honeypot). One-line change per the sitemap.
2. **Brevo DOI:** set the double-opt-in confirmation redirect for this list/flow to `https://benedictschweiger.com/training/confirmed/`. Verify whether the current workbook flow is already DOI; mirror its mechanics.
3. **Replace placeholders** in the `MM` config block at the top of each page's `<script>`:
   - `REPLACE_META_PIXEL_ID` (both pages)
   - `REPLACE_GA4_ID` (both pages)
   - `REPLACE_YOUTUBE_ID` (`/training/` — the unlisted training video, privacy-enhanced nocookie embed)
   - `MM.videoAspect` (`/training/`): `"16:9"` or `"9:16"` depending on the final master
   - `REPLACE_STRIPE_27_LINK` (`/training/` — the $27 recording payment link; product not yet created in Stripe)
   Pages run safely with placeholders: tracking stays off, the buy button is inert, the video shows a calm placeholder panel.
4. **CAPI function (per `tracking-spec.md` in the content engine):** both pages already POST every event to `/.netlify/functions/capi` with `{event_name, event_id, event_source_url, ...}` and fail silently. Build the function to relay to Meta CAPI + GA4 Measurement Protocol, deduplicating via the shared `event_id`. Until it exists nothing breaks.

## Flags (decide / fix before ads run)

- **Consent:** both pages carry a minimal inline consent banner (localStorage `mm-consent`); no tracking fires before accept. It is a stopgap until a site-wide CMP in the rebuild. Costs measurement on non-consenting visitors; that is the compliant default for EU paid traffic.
- **Headshot missing:** `/images/bene-headshot.jpg` is referenced by `/start/` AND by the existing `/workbook-signup/` page, but the file does not exist in `static/images/`. Upload it (it currently 404s on both pages).
- **Legal pages:** footers link to `/impressum/` and `/datenschutz/`. Both are legally required before ads run and do not exist yet.
- **Title length:** the training video length is stated as "about 30 minutes" on `/start/`. If the final edit lands materially shorter or longer, adjust the eyebrow + lead + check-inbox step 3.
- **Price/currency:** offer shows **$27 USD** (locked D3). Note the upsell ladder currency mismatch flagged in the 2026-06-10 audit ($ vs € for the €190/€690 workshop) — resolve before `/recording/welcome/` is built.

## Brand/voice conformance (checked)

Hanken Grotesk, Mist/Ink palette, terracotta used once per surface (the primary button), AA-safe `#A8502F` for accent text, pill buttons with press-scale, 2px focus rings, 4/8 spacing, sentence-case headlines ending in periods, reduced-motion honored. Copy voice-linted: no em dashes, no contrast-negation, numerals for figures, cleared proof only (8→5, +20%, €4M→€20M, 5 do the work of 10).
