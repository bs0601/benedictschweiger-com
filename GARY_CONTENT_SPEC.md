# Gary Content Spec — Blog Post Requirements

Every blog post Gary generates must include the complete frontmatter below before being committed
to `content/blog/` and submitted for review. Incomplete frontmatter = broken SEO and schema.

## Mandatory Frontmatter

```yaml
---
title: "Full post title — ideally 50–60 chars, includes primary keyword"
date: YYYY-MM-DD
slug: "url-slug-here"         # explicit, matches filename, no date prefix
draft: true                   # ALWAYS true — flipped to false on Bene's approval
description: "Meta description under 160 chars. Specific, benefit-oriented. No trailing period."
author: "Benedict Schweiger"
tags:
  - "primary keyword phrase"
  - "secondary keyword phrase"
  - "tertiary keyword phrase"
keywords:                     # search-intent keywords, different from tags
  - "exact phrase a searcher would type"
  - "another exact search phrase"
cover:
  image: "/images/blog/[slug]-og.png"   # 1200x630px OG image Gary generates
  alt: "Descriptive alt text for the cover image"
  relative: false
hasFAQ: true                  # set true whenever FAQs are present
faq:
  - question: "Question exactly as a searcher would type it"
    answer: "Concise, complete answer. 2–4 sentences. No fluff."
  - question: "Second question"
    answer: "Second answer."
  - question: "Third question"
    answer: "Third answer."
  - question: "Fourth question"
    answer: "Fourth answer."
  - question: "Fifth question"
    answer: "Fifth answer."
---
```

## Rules

### Title
- 50–60 characters
- Includes the primary keyword
- Written for a human, not keyword-stuffed
- Sentence case, not Title Case

### Description (meta description)
- Under 160 characters — hard limit
- Should state what the post delivers concretely
- No "In this post we will..." framing
- No trailing period

### Slug
- Lowercase, hyphens only
- No date prefix
- Matches the filename exactly: `content/blog/{slug}.md`

### Tags vs Keywords
- `tags` → content categories and broad topic areas, rendered on the page
- `keywords` → exact search queries a person would type into Google, used in meta keywords tag

### Cover image
- Gary must generate a 1200×630px OG image and save it to `static/images/blog/[slug]-og.png`
- Alt text should describe what is shown, not just repeat the title

### FAQs
- Minimum 4, ideally 5–6 questions
- Questions must match real search queries (check keyword intent)
- Answers must be self-contained — readable without the article
- These render as FAQ schema (rich results) so quality matters
- `hasFAQ: true` must be set in frontmatter

### Draft flag
- Always commit as `draft: true`
- The approval function (`content-approval.js`) flips this to `false` via GitHub API on Bene's approval
- This triggers a Netlify rebuild and the post goes live automatically
- Never commit as `draft: false` — that bypasses the review pipeline

## Review Page Requirements

When Gary creates the review HTML at `static/review/[slug]/index.html`, it must include:
- Full rendered post content (same as what will be published)
- Carousel slideshow for any carousel examples (scrollable strip, 260px height)
- Callout blocks styled correctly
- The approval bar at the bottom (copy from existing review pages)
- The slug must match the markdown file slug exactly

When Gary adds to `static/review/pending.json`:
```json
{
  "slug": "url-slug-here",
  "title": "Full post title",
  "type": "blog",
  "pillar": "Agentic Marketing",
  "created": "May 07, 2026"
}
```

## What happens on approval

1. Bene clicks ✅ Approve on the review page
2. Netlify function reads `content/blog/{slug}.md` from GitHub
3. Flips `draft: true` → `draft: false`
4. Commits via GitHub API (message: `Publish: {slug}`)
5. GitHub push triggers Netlify build
6. Post goes live at `benedictschweiger.com/blog/{slug}/` in ~60 seconds
7. Telegram confirmation sent to Bene
8. Slug marked as dismissed — disappears from review dashboard

## TLDR (mandatory for every blog post)

Every article must open with a **TLDR** as a bullet list, placed before the first paragraph. Format:

```markdown
**TLDR**
- [key point 1]
- [key point 2]
- [key point 3]
- [key point 4]
- [key point 5 — optional]
```

4–6 bullets. Each one is a standalone takeaway a reader could act on or remember. Not teaser copy — actual substance.

## Validation (mandatory before every commit)

Before committing any post, Gary must run:

```bash
node scripts/validate-post.js content/blog/{slug}.md
```

The script checks all mandatory frontmatter fields and exits non-zero on errors. Fix all errors before committing. Warnings are advisory but should be addressed where possible.

Do not commit a post that fails validation.

---

# Social Post Spec — Carousel Publishing

## Image files

Place 5 PNG slides at:
```
static/images/carousels/[slug]/slide-01.png
static/images/carousels/[slug]/slide-02.png
static/images/carousels/[slug]/slide-03.png
static/images/carousels/[slug]/slide-04.png
static/images/carousels/[slug]/slide-05.png
```

## pending.json entry

Add this object to `static/review/pending.json`:
```json
{
  "slug": "carousel-slug-here",
  "title": "Carousel: Post Title",
  "type": "social",
  "platforms": ["linkedin", "instagram"],
  "caption_linkedin": "Full LinkedIn caption text here...",
  "caption_instagram": "Instagram caption text #hashtags #here",
  "images": [
    "/images/carousels/carousel-slug-here/slide-01.png",
    "/images/carousels/carousel-slug-here/slide-02.png",
    "/images/carousels/carousel-slug-here/slide-03.png",
    "/images/carousels/carousel-slug-here/slide-04.png",
    "/images/carousels/carousel-slug-here/slide-05.png"
  ],
  "created": "May 08, 2026"
}
```

## Generate the review page

```bash
node scripts/generate-social-review.js static/review/pending.json [slug]
```

This creates `static/review/[slug]/index.html` with LinkedIn and Instagram previews plus the approval bar.

## LinkedIn caption guidelines

- 150–300 characters
- Hook in the first line — this is what shows before "...see more"
- No hashtags (LinkedIn penalizes them in reach)
- End with a question or observation that invites engagement
- Professional but conversational tone

## Instagram caption guidelines

- 100–150 characters visible before "...more"
- Hashtags go in the first comment, not in the caption itself
- Casual, personal tone
- Can use emoji sparingly

## What happens on approval

1. Bene clicks ✅ Approve on the review page
2. `social-publish` function posts to LinkedIn (multi-image post) and Instagram (carousel)
3. Telegram confirmation sent to Bene with per-platform status
4. Slug marked as dismissed — disappears from review dashboard

---

## What Gary must NOT do
- Commit `draft: false` directly
- Skip FAQs or hasFAQ
- Write a description over 160 chars
- Use a slug that doesn't match the filename
- Forget the cover image
