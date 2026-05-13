# Agentic Content Runbook

**Version:** 1.0  
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

---

## Weekly Rhythm

### Monday — Idea Capture

**Trigger:** 09:00 GMT-3, or when Bene drops raw material in Telegram

**Input:**
- Bene's voice note, text message, or Notion page with raw idea
- Or: agent proactively prompts Bene with "What happened this week that surprised you?"

**Process:**
1. Read the raw material
2. Run 5-question extraction interview with Bene (if needed):
   - What specifically happened?
   - What number or outcome resulted?
   - What did you expect vs. what actually happened?
   - What would someone else get wrong about this?
   - Which pillar does this belong to?
3. Distill into 3–5 Content Atoms
4. Add each Atom to Content Atoms DB with:
   - Type (quote / framework / data / decision / take / provocation)
   - Source (Bene's message / meeting / observation)
   - Pillar
   - Platform fit (LinkedIn / Blog / Both)
5. Create Content Library rows for planned pieces this week:
   - 1 blog post (pillar article)
   - 3 LinkedIn posts
   - Status = Draft
   - Link Atom IDs

**Output:**
- Content Atoms DB: 3–5 new atoms
- Content Library: 4 new rows (1 blog + 3 LinkedIn)

**Notion fields updated:**
- Content Atoms: all fields
- Content Library: Name, Status = Draft, Pillar, Platform, Format, Atom ID, Week

---

### Tuesday — Draft Generation

**Trigger:** 09:00 GMT-3

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
4. **LinkedIn posts:** Write text + generate card image
   - Character count: 150–300 words
   - Include hook, story/data, takeaway, CTA
   - Generate card image (1200×627px)
5. Update Content Library status to Draft (confirmed)

**Output:**
- Blog draft in repo
- 3 LinkedIn post drafts + card images
- All drafts linked to Atom IDs

**Notion fields updated:**
- Content Library: Status = Draft (confirmed), Target Keyword

---

### Wednesday — Approval Gate

**Trigger:** 09:00 GMT-3 (send to Bene), or when Bene requests review

**Input:**
- Blog post markdown
- LinkedIn post texts + card images

**Process:**
1. **Blog post:**
   - Generate PDF preview (clean formatted document)
   - Generate audio version via Mistral Voxtral TTS
   - Send PDF + audio voice message to Bene via Telegram
   - Caption: "📄 [Title] | Pillar: [X] | Word count: [N] | ✅ Approve / 🔄 Revise"
2. **LinkedIn posts:**
   - Generate PDF with post text + card image
   - Send PDF to Bene via Telegram
   - Caption: "💼 [Title] | Pillar: [X] | Chars: [N] | ✅ Approve / 🔄 Revise"
3. **Carousels (if any):**
   - Generate PDF with all slides + captions
   - Send PDF to Bene via Telegram
   - Caption: "🎠 [Title] | Slides: [N] | ✅ Approve / 🔄 Revise"
4. Write to `gary/state/pending-approvals.json`
5. **Do NOT message Bene again.** Heartbeat handles reminders.

**Output:**
- Telegram message(s) with PDF + audio (blog) / PDF (LinkedIn, carousel)
- pending-approvals.json updated

**Notion fields updated:**
- None (wait for approval)

**Bene's actions:**
- Tap ✅ Approve → proceed to Thursday publish
- Tap 🔄 Revise → reply with specific feedback
- Ignore → heartbeat reminder after 12 hours

---

### Thursday — Publish

**Trigger:** Upon Bene's approval, or 09:00 GMT-3 if approved Wednesday night

**Input:**
- Approved items from pending-approvals.json

**Process:**

**Blog post:**
1. Flip `draft: false` in frontmatter
2. Commit and push to GitHub
3. Netlify auto-deploys (~60 seconds)
4. Fill Published URL in Content Library
5. Update status to Published

**LinkedIn post:**
1. Schedule via LinkedIn API for optimal time (Tue/Thu/Sat)
2. Post text + card image
3. Fill Published URL in Content Library
4. Update status to Scheduled, then Published after posting

**Carousel:**
1. Schedule slides + caption via relevant API
2. Fill Published URL in Content Library
3. Update status to Scheduled, then Published

**Newsletter (if active):**
1. Compile from week's pillar content
2. Schedule in Brevo
3. Update Content Library status

**Output:**
- Live blog post
- Scheduled/published LinkedIn posts
- Content Library updated

**Notion fields updated:**
- Content Library: Status → Published, Published URL, Publish Date

---

### Friday — Measurement

**Trigger:** 17:00 GMT-3

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
4. **Update Content Atoms:**
   - For each Atom referenced by published items in last 7 days:
     - Increment Times Used
     - Set Last Used date
5. **Generate Friday report** (5 lines max):
   - Top 3 performing posts (by impressions/reactions)
   - Top 3 performing Atoms (by Times Used)
   - 1 suggested double-down for next week
   - 1 thing to stop or change

**Output:**
- Notion fields updated with metrics
- Friday report posted to Telegram or Notion

**Notion fields updated:**
- Content Library: LinkedIn Impressions, LinkedIn Reactions, Instagram Impressions, Instagram Saves
- Content Atoms: Times Used, Last Used

---

## Content Standards

### Blog Posts
- Length: 1,500–2,500 words
- Structure: Hook → Story → Data → Framework → CTA
- Frontmatter required: title, date, slug, description (<160 chars), author, tags, keywords, cover
- Every external link goes to the specific page with the specific claim
- Counterfactual check: every "AI replaced X" claim needs counterfactual in same paragraph
- TL;DR: exactly 3 bullets
- One uncomfortable sentence minimum

### LinkedIn Posts
- Length: 150–300 words
- Structure: Hook (1 line) → Story/Data (3–5 lines) → Takeaway (2 lines) → CTA (1 line)
- Card image: 1200×627px, minimal text, strong visual
- No em dashes, no boldface overuse
- Signature move rate limit: "This is not X. It is Y." max 2 per month

### Carousels
- 5–8 slides
- Slide 1: Hook (problem or surprising claim)
- Slides 2–4: Story, data, framework
- Slide 5: CTA
- Consistent visual style (colors, fonts, spacing)

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
| Mistral API | Audio generation | `memory/credentials.env` |
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

---

## Changelog

| Date | Change | Reason |
|---|---|---|
| 2026-05-13 | v1.0 | Consolidated from 3 hubs, 4 databases into 1 hub, 1 DB |
| | Switched review from web pages to Telegram PDF + audio | Simpler, faster, mobile-native |
| | Locked pillars to 4 | Eliminated schema drift |

---

*This runbook is a contract. If a step doesn't work, change the runbook — don't work around it.*
