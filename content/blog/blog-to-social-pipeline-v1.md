---
title: "Blog to Social: The Pipeline That Actually Runs My Content"
date: 2026-05-14
slug: "blog-to-social-pipeline-v1"
draft: true
description: "The full architecture of my blog-to-social pipeline: how an idea becomes posts across every platform — what works, what breaks, and what is still broken"
author: "Benedict Schweiger"
tags:
  - "agentic marketing"
  - "content automation"
  - "social media pipeline"
  - "linkedin automation"
keywords:
  - "blog to social media automation"
  - "ai content pipeline"
  - "automate linkedin posts from blog"
  - "agentic content production"
  - "content atom repurposing"
cover:
  image: "/images/blog/blog-to-social-pipeline-v1-og.png"
  alt: "Diagram showing blog post flowing through extraction, atomisation, and distribution to LinkedIn and Instagram"
  relative: false
hasFAQ: true
faq:
  - question: "How do you turn one blog post into multiple social media posts?"
    answer: "I extract 6–10 content atoms from each blog post using Gemini 2.5 Flash. Each atom is a standalone insight with a subject, claim, and proof. These atoms feed a content agent that builds LinkedIn posts, Instagram carousels, and captions — each from a single atom, not from the full article. One blog post becomes 6–10 social pieces, each with a clear source of truth."
  - question: "What is a content atom in marketing?"
    answer: "A content atom is a distilled insight from a longer piece — a specific claim, decision, or proof point that can stand alone. It is not a quote. It contains a subject, a claim, and proof. Every derivative piece of content traces back to one atom, keeping the argument consistent across platforms."
  - question: "How does AI approval workflow work for content publishing?"
    answer: "Every piece of content gets a private review page at benedictschweiger.com/review/[slug]/ with platform-native previews. I swipe through carousel slides, read LinkedIn posts as they will appear, and approve or request revision with one click. On approval, a Netlify function publishes to the blog via GitHub API, LinkedIn via REST API, and Instagram via Graph API — all in under 60 seconds."
  - question: "What tools do you use for automated content distribution?"
    answer: "OpenClaw runs the agent orchestration. Gemini 2.5 Flash extracts atoms. Google Slides API generates carousel PNGs. GitHub API flips draft posts to live. Netlify handles hosting and serverless functions. LinkedIn REST API and Instagram Graph API handle social publishing. Telegram confirms each step. Total tool cost: under $20 per month."
  - question: "What breaks in automated content pipelines?"
    answer: "Five things broke in my pipeline: Google Slides API cannot change page size programmatically, emoji rendering fails in server-side exports, LinkedIn image uploads require separate API calls from post creation, Instagram requires publicly accessible image URLs before publishing, and template variety limits creative range. Each failure taught me what the APIs actually do versus what their documentation claims."
---

**TLDR**
- One blog post feeds every social platform through content atoms — distilled insights, not quotes.
- The pipeline runs on OpenClaw, Gemini, Google Slides API, and Netlify functions. Tool cost: under $20 per month.
- Five things broke during the build. Each one revealed a gap between API documentation and API reality.
- The approval gate is not editing. It is a pass/fail check. If I am rewriting paragraphs, the generation failed.
- Template variety is the current bottleneck. More templates, not abandoning the system, is the fix.

---

The gap between having an idea and having a published post is where most content goes to die.

I have ideas. What I do not have is time to develop every one into a post, design the creative, write the caption, format for two platforms, and hit publish — all while running marketing for a [watch retailer](https://www.altherr.de) doing eight figures in revenue. Something has to give.

Many people solve this by posting less. I solved it by building a pipeline.

This is what that pipeline actually looks like. Not the polished version. The version that runs right now, with its flaws and holes and the five things that broke along the way.

## What the pipeline actually does

The agent I call Gary handles everything between "I have an idea" and "this is ready for your approval." That includes keyword research, structuring the content, writing the article, formatting for LinkedIn and Instagram, generating the carousel slides, and creating a review page where I can see both platform previews before anything goes live.

What Gary does not do is think. It does not have opinions, real experience, or skin in the game. That is where the interview step comes in.

Before Gary writes a single word, it asks me questions. Not generic ones. Targeted questions based on the keyword research it ran before the conversation. What was the specific frustration? What would I tell someone starting from zero? What surprised me about building this? My answers are what make the content worth reading. Gary's job is to turn those answers into something well-structured, properly formatted, and ready to ship.

The result is content that sounds like me, because the thinking is mine. The execution is automated.

## The architecture, plainly

Here is what runs under the hood:

1. **Brief** — I describe the topic and core angle to Gary
2. **Research** — Gary runs keyword analysis via [DataForSEO](https://dataforseo.com) to find the right search terms and assess competition
3. **Interview** — Gary asks 5–7 targeted questions; I answer in plain language
4. **Generation** — Gary writes the blog post (full frontmatter, FAQs, proper structure) and drafts captions for both LinkedIn and Instagram
5. **Atom extraction** — [Gemini 2.5 Flash](https://deepmind.google/technologies/gemini/flash/) reads the published post and identifies 6–10 content atoms, each stored in a [Notion](https://notion.so) database with metadata: source post, type (data point / provocation / decision / mechanism), platform fit, and status
6. **Social build** — Gary picks an atom, reads the full source article for context, writes a carousel brief (hook, tension, proof, reframe, CTA), and generates five PNGs via the [Google Slides API](https://developers.google.com/workspace/slides/api/guides)
7. **Review** — Gary commits everything to a private review page with native-style platform previews
8. **Approval** — I read through, check for false claims and flow, hit Approve
9. **Publish** — one function call: GitHub API flips the blog post from draft to live, Netlify rebuilds, Google Indexing API gets notified, and the social posts go out to LinkedIn and Instagram simultaneously. Telegram confirms it worked.

The whole thing from approval to live post takes under 60 seconds.

## Where I actually sit in this process

Not at a desk writing. Not in Canva designing slides. At an approval gate.

When I review a post, I am checking three things: does it make any false claims, does it flow well enough that I would actually read it, and would it genuinely interest someone in my audience. If the answer to all three is yes, I approve. If something is off, I hit Revise and write one sentence of feedback. Gary rewrites and resubmits.

That is the whole job. Everything else is automated.

The important thing to understand about this model: the approval gate is not where the content gets made. It is where bad content gets stopped. If I am rewriting paragraphs at the approval step, the generation step failed. The bar is either "this is good enough to publish as-is" or "this needs to be regenerated." There is no in-between state where I become a human editor.

## What actually broke

Building this, I expected the technical parts to be the hard part. They were not.

**1. Google Slides API cannot change page size.**

I needed portrait 4:5 slides for LinkedIn carousels. The `pageSize` field exists in the Slides API data model. It does not exist in `batchUpdate`. You cannot set it programmatically. The workaround is embarrassingly simple: set the page size once, manually, in the Google Slides UI. Every clone inherits it. The template becomes the source of truth for anything the API cannot control.

**2. Emoji rendering fails in server-side exports.**

The thread emoji on carousel slides was set to white, confirmed white in the API data, correctly positioned. It did not appear in exports. The root cause: the Inter font has no emoji glyphs. The Google Slides server-side PNG renderer has no emoji fallback. If the font cannot render the character, the character disappears. The fix: paste the emoji as an image element directly into the template. Images always render. Text emoji never will in this pipeline.

**3. LinkedIn image uploads are separate from post creation.**

Most tutorials show a single API call to create a post with an image. That is not how it works. You initialise an image upload, get a URL, upload the binary, collect the resulting image URN, then create the post with a multiImage content block referencing those URNs. Three separate API calls. The documentation mentions this. Most tutorials do not.

**4. Instagram requires publicly accessible image URLs.**

Instagram's Graph API does not accept image uploads directly. You create a media container with a public URL, then publish it. The images must already be hosted somewhere Instagram's servers can fetch them. Local files or signed URLs do not work. This means the generation step must upload to a public CDN before the publish step can run.

**5. Template variety limits creative range.**

Templates are necessary for automation. Gary needs a consistent structure to work from. But templates limit variety. The carousels I can generate today follow two formats: photo header and X/Twitter screenshot style. That is a narrower creative range than I would choose if I were designing from scratch every time. The fix is more templates, not abandoning the system.

## The content atom layer

This is the part most content teams get wrong.

They have a blog post. They want social content. So they extract a quote, post it on LinkedIn, screenshot it for Instagram, and call that repurposing. Each derivative loses a bit of the original argument. The Instagram post is a weaker version of the LinkedIn post, which is a weaker version of the article. Nobody notices because the audience differs on each platform. But the internal logic is gone.

I solved this by building what I call a content atom pipeline.

An atom is a distilled insight from a long-form piece — a specific claim, decision, or proof point that can stand alone. "At ALTHERR, we replaced two marketing roles with [N8N](https://n8n.io) workflows in December. Headcount dropped. Output held." That is an atom. It contains a subject, a claim, and a proof. It is not a quote; it is a compressed argument.

Every blog post I publish now gets run through an extraction step. Gemini 2.5 Flash reads the article and identifies 6–10 atoms. Each atom lands in a Notion database. That database is the source of truth for all content planning.

When Gary picks an atom to build from, the first step is always reading the full source article. The atom is the entry point, not the brief. A good content brief without the surrounding context produces thin copy. The article carries the detail, the failure, the specific reasoning that makes a post worth reading.

## The double-click principle

The rule I care most about: slides and caption are two different information layers.

Slides stand alone. Someone who never reads the caption gets the full idea. The hook stops the scroll, the tension frames the problem, the proof is specific and named, the reframe lands the insight.

The caption carries what the slides do not show. Not a written summary of what is already visible. The story behind the decision, the failure that preceded the success, the context that makes the proof meaningful. Someone who swipes through the carousel and then reads the caption should learn something new.

Many content teams do the opposite. They write the slides, then summarise them in the caption. The result is redundant — people who read captions stop reading because they already saw the point.

LinkedIn and Instagram also get separate copy. Different platform, different character range, different hashtag logic, different tone. The atom is the shared idea. The execution is platform-native.

## What this actually costs

The tool stack is deliberately minimal:

- OpenClaw (agent orchestration) — free, self-hosted
- Gemini 2.5 Flash (atom extraction) — ~$0.01 per post
- Google Slides API (carousel generation) — free
- GitHub API (publish trigger) — free
- Netlify (hosting + serverless functions) — free tier
- LinkedIn REST API + Instagram Graph API — free
- DataForSEO (keyword research) — ~$0.05 per query
- Notion (atom database) — free

Total cost per blog post: under $0.50. Total cost per carousel: zero. The only real cost is the time to build the system — and that is a one-time investment.

## What I still have not fixed

This is version one. It works. It is not complete.

**Video is missing.** I have not automated YouTube shorts or Reels. The pipeline handles static images and text. Video requires a different generation layer — likely [HeyGen](https://www.heygen.com) or similar — and I have not found one that clears my quality bar.

**Email is missing.** The newsletter is still manual. I write it, or Gary drafts it and I rewrite it. The atom pipeline could feed email, but the format is different — longer, more narrative, less punchy. I have not built the bridge.

**Performance feedback is manual.** I track LinkedIn impressions and Instagram saves, but the data does not flow back into the atom database automatically. I have to check each post and update the atom record by hand. The loop is closed in theory. In practice, it is open.

**Template variety is the real bottleneck.** Two carousel templates is not enough. I need five or six to keep the feed from looking robotic. Each template requires design work in Google Slides, then testing in the generation pipeline. That is the work I am doing now.

## Why personal input is non-negotiable

There is a version of this pipeline that skips the interview step entirely. Gary generates a brief from a topic keyword, writes the post, submits for approval. It is faster.

It also produces content that has no reason to exist.

There are already many articles about content automation. What it does not have is my specific experience building this at a company I have run marketing for since 2020, with the specific constraints of a bootstrapped operation, validated on my own setup before I trust it with a real business. That context is what makes a post original. That is what the interview extracts.

If the content is not lasting and original, there is no point publishing it. The pipeline exists to scale the output of ideas that are worth scaling, not to manufacture volume for its own sake.

## The verdict

Most creators and marketers are stuck optimising process when they should be eliminating it. The difference between "I streamlined my workflow" and "I automated my pipeline" is not semantic. One still requires you in the chair. The other does not.

This pipeline took one working session to build. It will produce every piece of content I publish for the rest of the year. The marginal cost of the next post is two minutes of writing a brief and one click to approve. The marginal cost of the fiftieth post is the same.

And the five PNGs the script produces are not locked to LinkedIn. The same files go to Instagram, Facebook, anywhere that accepts images. Build the generation layer once, and distribution becomes a configuration problem, not a production problem.

The tools exist. The APIs are free. The only cost is the willingness to treat content creation as an engineering problem, not a creative ritual.

---

*This post was produced through the exact pipeline it describes. Gary interviewed me, wrote the draft based on my answers, and I approved it before it went live.*

*Want to understand where your marketing operation sits on the agentic curve? [Take the Autonomy Score →](/autonomy-score/)*
