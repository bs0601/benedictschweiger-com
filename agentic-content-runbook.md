# Agentic Content Runbook

**Version:** 1.2  
**Date:** 2026-05-13  
**Owner:** Benedict Schweiger + Hugo (AI operations partner)  
**Review cycle:** Monthly, or when a step breaks twice

---

## Philosophy

This runbook exists because "abandonment, shiny object syndrome" is the documented failure mode. The strategy is consistency and compounding — not a new direction every month.

**Rules:**
- One hub (AMO Hub — Agentic Marketing OS)
- One content database (Content Library)
- Four pillars only
- No new channels until LinkedIn → email closes subscribers for 4 consecutive weeks
- No draft without a linked Atom ID
- **Bene's time budget: 30 minutes/week total after week 4**

---

## Weekly Rhythm

### Monday — Idea Capture (Bene: 5 min)

**Trigger:** 09:00 GMT-3, or when Bene drops raw material in Telegram  
**Owner:** Agent (default) / Both (fallback interview)

**Input:**
- Bene's voice note, text message, or Notion page with raw idea
- Or: agent proactively prompts Bene with "What happened this week that surprised you?"

**Process:**
1. Read the raw material
2. **Default path:** Agent extracts 3–5 Content Atoms directly from the material
3. **Fallback path** (if atoms are thin/vague): Agent sends Bene a single message — "Extracted these atoms. Anything missing?" — and only runs the 5-question interview if Bene says yes or the atoms score below 3
4. Score each atom 1–5 on specificity:
   - Named entity? (person, company, tool)
   - Real number? (metric, outcome, time saved)
   - Counterfactual present? (what was expected vs. what happened)
   - Score < 3 → re-interview or drop
5. Add passing atoms to Content Atoms DB with:
   - Type (quote / framework / data / decision / take / provocation)
   - Source (Bene's message / meeting / observation)
   - Pillar
   - Platform fit (LinkedIn / Blog / Both)
6. Create Content Library rows for planned pieces this week:
   - 1 blog post (pillar article)
   - 2–3 LinkedIn posts (based on atom count and quality)
   - Status = Draft
   - Link Atom IDs

**Output:**
- Content Atoms DB: 3–5 new atoms (only passing scores)
- Content Library: 3–4 new rows (1 blog + 2–3 LinkedIn)

**Notion fields updated:**
- Content Atoms: all fields
- Content Library: Name, Status = Draft, Pillar, Platform, Format, Atom ID, Week

---

### Tuesday — Draft Generation (Bene: 0 min)

**Trigger:** 09:00 GMT-3  
**Owner:** Agent

**Input:**
- Content Library rows with Status = Draft
- Linked Atom IDs from Content Atoms DB

**Process:**
1. Query Content Library for this week's Draft items
2. For each item:
   - Read linked Atoms
   - Check style guide (`memory/hugo-style-guide.md`)
   - Generate draft in correct format
3. **Blog post:** Write full markdown to `content/blog/[slug].md`
   - Frontmatter: title, date, slug, description, author, tags, keywords, cover
   - Run `validate-post.js`
   - Draft = true
4. **LinkedIn posts:** Write carousel brief + generate slides
   - Caption: 150–300 words
   - Structure: Hook (1 line) → Story/Data (3–5 lines) → Takeaway (2 lines) → CTA (1 line)
   - Generate carousel brief JSON (`gary/carousels/briefs/<slug>.json`)
   - Run `alan/scripts/generate-carousel.py` with v2 template only
   - Output: 5 PNGs + PDF to `gary/carousels/<slug>/`
   - **Exception:** If the atom is a single sharp quote or data point that doesn't justify 5 slides, agent marks it as `format: single-image` in Content Library and generates a single text-on-image card instead
5. Update Content Library status to Draft (confirmed)

**Output:**
- Blog draft in repo
- 2–3 LinkedIn post drafts (carousles or single-image)
- All drafts linked to Atom IDs

**Notion fields updated:**
- Content Library: Status = Draft (confirmed), Target Keyword

---

### Wednesday — Approval Gate (Bene: 10 min)

**Trigger:** 09:00 GMT-3 (send to Bene), or when Bene requests review  
**Owner:** Agent sends / Bene approves

**Input:**
- Blog post markdown
- LinkedIn post texts + carousel PDFs

**Process:**
1. **Blog post:**
   - Generate PDF preview (clean formatted document)
   - Send PDF to Bene via Telegram
   - Caption: "📄 [Title] | Pillar: [X] | Word count: [N] | ✅ Approve / 🔄 Revise"
   - No audio by default (Bene can request via voice note if he wants it)
2. **LinkedIn posts (carousels):**
   - Send PDF with all 5 slides + caption text
   - Caption: "💼 [Title] | Pillar: [X] | Slides: 5 | ✅ Approve / 🔄 Revise"
3. **LinkedIn posts (single-image, if any):**
   - Send image file + caption text
   - Caption: "💼 [Title] | Pillar: [X] | Single image | ✅ Approve / 🔄 Revise"
4. Write to `gary/state/pending-approvals.json`
5. **Do NOT message Bene again.** Heartbeat handles reminders.

**Hard rule — Approval timeout:**
- If not approved by Thursday 12:00 GMT-3:
  - Publish the previous week's evergreen backup (if available), OR
  - Skip the slot and log it in Content Library as "Skipped — timeout"
  - Do NOT let the queue silently fill up

**Output:**
- Telegram message(s) with PDF (blog) / PDF or image (LinkedIn)
- pending-approvals.json updated

**Notion fields updated:**
- None (wait for approval)

**Bene's actions:**
- Tap ✅ Approve → proceed to Thursday publish
- Tap 🔄 Revise → reply with specific feedback
- Ignore → heartbeat reminder after 12 hours, then timeout rule kicks in

---

### Thursday — Publish (Bene: 0 min)

**Trigger:** Upon Bene's approval, or 09:00 GMT-3 if approved Wednesday night  
**Owner:** Agent

**Input:**
- Approved items from pending-approvals.json

**Process:**

**Blog post:**
1. Flip `draft: false` in frontmatter
2. Commit and push to GitHub
3. Netlify auto-deploys (~60 seconds)
4. Fill Published URL in Content Library
5. Update status to Published

**LinkedIn post (carousel):**
1. Post caption text via LinkedIn API
2. Upload 5 slide images in sequence
3. Fill Published URL in Content Library
4. Update status to Published

**LinkedIn post (single-image):**
1. Post caption text + single image via LinkedIn API
2. Fill Published URL in Content Library
3. Update status to Published

**Newsletter (if active):**
1. Compile from week's pillar content
2. Schedule in Brevo
3. Update Content Library status

**Output:**
- Live blog post
- Published LinkedIn posts
- Content Library updated

**Notion fields updated:**
- Content Library: Status → Published, Published URL, Publish Date

---

### Friday — Metrics (Auto) (Bene: 0 min)

**Trigger:** 17:00 GMT-3  
**Owner:** Agent (fully automated)

**Input:**
- Content Library items with Status = Published from last 14 days

**Process:**
1. **Pull LinkedIn metrics** (via API if available, or manual check):
   - Impressions, reactions, comments per post
   - Match to Content Library row via Published URL
   - Write to LinkedIn Impressions / LinkedIn Reactions fields
2. **Pull Brevo metrics:**
   - New subscribers this week
   - Write count to Strategy Hub KPI Baseline (or memory file)
3. **Pull blog metrics:**
   - Netlify Analytics or Google Analytics page views
   - Write to Content Library if field exists
4. Post auto-metrics to Telegram (no strategic commentary):
   ```
   📊 Week of [date]
   LinkedIn: [N] posts, [N] impressions, [N] reactions
   Blog: [N] views
   Email: +[N] subscribers
   ```

**Output:**
- Notion fields updated with metrics
- Auto-metrics posted to Telegram

**Notion fields updated:**
- Content Library: LinkedIn Impressions, LinkedIn Reactions, Instagram Impressions, Instagram Saves

---

### Monthly — Strategic Review (Bene: 15 min)

**Trigger:** First Monday of each month  
**Owner:** Agent generates / Bene reviews

**Process:**
1. Agent analyzes 4-week rolling data
2. Generates strategic report (10 lines max):
   - Top 3 performing posts (by impressions/reactions)
   - Top 3 performing atoms (by engagement)
   - 1 suggested double-down for next month
   - 1 thing to stop or change
   - 1 format or pillar to experiment with
3. Send to Bene via Telegram

**Output:**
- Monthly strategic report

---

## Content Standards

### Blog Posts
- Length: 1,500–2,500 words
- Structure: Hook → Story → Data → Framework → CTA
- CTA destination: `benedictschweiger.com` (with UTM params)
- Frontmatter required: title, date, slug, description (<160 chars), author, tags, keywords, cover
- Every external link goes to the specific page with the specific claim
- Counterfactual check: every "AI replaced X" claim needs counterfactual in same paragraph
- TL;DR: exactly 3 bullets
- One uncomfortable sentence minimum

### LinkedIn Posts (Carousles Default)
- Caption: 150–300 words
- Structure: Hook (1 line) → Story/Data (3–5 lines) → Takeaway (2 lines) → CTA (1 line)
- CTA destination: `benedictschweiger.com` (with UTM params)
- Default: 5-slide carousel (v2 template)
- Exception: single-image allowed when atom is a sharp quote or single data point
- No em dashes, no boldface overuse
- Signature move rate limit: "This is not X. It is Y." max 2 per month

### Carousel Template (v2 Only)
- Template: X/Twitter screenshot style (dark bg, Inter font, 🧵 emoji)
- 5 slides, portrait 10in × 12.5in
- Slide 1: Hook (dark bg, circular avatar)
- Slide 2: Tension (warm white, label + body)
- Slide 3: Proof (warm white, label + body)
- Slide 4: Reframe (dark bg)
- Slide 5: CTA (orange bg → benedictschweiger.com with UTM params)
- Generation: `alan/scripts/generate-carousel.py` with brief JSON

---

## Pillar Definitions

### 1. Customer First
Start with understanding what the customer really wants. Most companies skip this.
- Topics: pricing, loyalty, customer research, value proposition
- Angles: ALTHERR stories, counterintuitive findings, "what we got wrong"

### 2. Play the Long Game
True moats are built over years.
- Topics: compounding, SEO, email lists, YouTube, brand building
- Proof points: ALTHERR YouTube 5.2M views, 12k email subs, 50% SEO traffic

### 3. Agentic Marketing
Human + AI hybrid teams. Highest differentiation angle.
- Topics: AI tools, workflows, team restructuring, measurement
- Live lab: Bene's personal setup, then ALTHERR

### 4. Trust the Numbers
Data-driven decisions. No gut feeling without data backing.
- Topics: marketing scorecard, KPIs, ROTS, attribution
- Frameworks: ROTS, Autonomy Score

---

## Tools & Credentials

| Tool | Purpose | Credential Location |
|---|---|---|
| Notion | Content tracking, atoms | `~/.config/notion/api_key` |
| LinkedIn API | Post publishing | `memory/credentials.env` |
| Brevo | Email list, newsletter | `memory/credentials.env` |
| GitHub | Blog hosting | `~/.ssh/benedictschweiger_deploy` |
| Mistral API | Audio generation (on request only) | `memory/credentials.env` |
| Google Slides API | Carousel generation | `memory/credentials.env` |
| Hugo | Blog build | Local install |
| Netlify | Blog deploy | Auto-deploy from GitHub |

---

## Failure Modes & Recovery

| Symptom | Likely Cause | Fix |
|---|---|---|
| Bene ignores approval requests | Too many requests, wrong time | Batch to 1 message, send at 09:00 |
| Drafts lack Atom IDs | Skipped Monday extraction | Reject draft, go back to Monday step |
| Metrics all zero | API creds expired | Check credentials.env, refresh tokens |
| Notion sync fails | Schema changed | Check Content Library fields match runbook |
| Blog deploy fails | Validation error | Run validate-post.js, fix frontmatter |
| LinkedIn post fails | Token expired | Re-auth via LinkedIn OAuth flow |
| Queue silently fills up | No timeout rule enforced | Publish evergreen or skip and log |
| Weekly strategic report is noise | 4-post sample size too small | Move strategy to monthly |

---

## Changelog

| Date | Change | Reason |
|---|---|---|
| 2026-05-13 | v1.0 | Consolidated from 3 hubs, 4 databases into 1 hub, 1 DB |
| | Switched review from web pages to Telegram PDF | Simpler, faster, mobile-native |
| | Locked pillars to 4 | Eliminated schema drift |
| | Killed generate-card.js, switched to Google Slides v2 only | More control, less mistakes |
| | LinkedIn: carousels default, single-image on rule line | Flexibility without laziness |
| 2026-05-13 | v1.1 | Added atom quality gate (1–5 scoring) | Prevent weak atoms → weak posts |
| | Added approval timeout rule (Thu 12:00) | Prevent queue abandonment |
| | Killed blog audio by default | Save cost and time |
| | Separated Friday metrics (auto) from monthly strategy | Weekly sample too small |
| | Killed Times Used tracking | Overhead without clear decision |
| | Added ownership markers (Agent / Bene / Both) | Prevent drift and confusion |

---

*This runbook is a contract. If a step doesn't work, change the runbook — don't work around it.*
