---
title: "I Built an Agentic Content Pipeline. Here's What It Actually Takes."
description: "I had ideas but no time to develop them at scale. So I built a pipeline: an AI agent interviews me, writes the content, and I approve before anything posts."
slug: "agentic-content-pipeline"
date: 2026-05-08
author: "Benedict Schweiger"
draft: true
tags:
  - Agentic Marketing
  - Content Automation
  - AI Tools
  - LinkedIn
  - Personal Brand
keywords:
  - "agentic content pipeline"
  - "ai content automation"
  - "content approval workflow"
  - "automate social media posts"
  - "linkedin api automation"
cover:
  image: "/images/og-default.png"
  alt: "Agentic content pipeline diagram"
hasFAQ: true
faq:
  - question: "What is an agentic content pipeline?"
    answer: "An agentic content pipeline is a workflow where an AI agent handles the execution of content creation — research, writing, formatting, publishing — while a human stays in the loop for the parts that require real judgment: input, direction, and final approval. The human doesn't disappear from the process; they move to where their time is actually worth spending."
  - question: "How do you automate posting to LinkedIn via API?"
    answer: "LinkedIn's REST API (version 202502) supports programmatic posting with the w_member_social OAuth scope. For multi-image posts (carousels), you initialize an image upload for each PNG, upload the binary to the provided URL, collect the resulting image URNs, then create a post with a multiImage content block. The key detail most tutorials miss: image uploads and post creation are separate API calls."
  - question: "How do you post a carousel to Instagram using the Graph API?"
    answer: "Instagram carousel posting via the Graph API is a three-step process: first, create individual media containers for each image using public URLs (not local files); second, create a carousel container referencing all item IDs; third, publish the carousel with a separate media_publish call. The images must already be publicly accessible — they're fetched by Meta's servers, not uploaded directly."
  - question: "How do you keep your voice when AI writes your content?"
    answer: "The interview step. Before the AI writes anything, it asks targeted questions based on keyword research — your specific frustration, your actual opinion, your real experience. Those answers seed the article. The AI handles structure, flow, formatting, and distribution. Your perspective is the thing it can't generate on its own. Skip the interview and you get generic output. Do it properly and the content sounds like you wrote it — because the thinking is yours."
  - question: "What is a content approval workflow and why does it matter?"
    answer: "A content approval workflow is the gate between AI-generated drafts and published content. In an agentic setup, the AI can produce and publish autonomously — the approval gate is what keeps that from being a disaster. It's where you check for false claims, verify the angle is right, and confirm the post would genuinely interest your audience. It's not editing; it's a final judgment call. That distinction matters: if you're rewriting paragraphs at approval, the generation step failed."
---

The gap between having an idea and having a published post is where most content goes to die.

I have ideas. What I don't have is time to develop every one into a post, design the creative, write the caption, format for two platforms, and hit publish — all while running marketing for a [watch retailer](https://www.altherr.de) doing eight figures in revenue. Something has to give.

Most people solve this by posting less. I solved it by building a pipeline.

## What the pipeline actually does

The agent I call Gary handles everything between "I have an idea" and "this is ready for your approval." That includes keyword research, structuring the content, writing the article, formatting for LinkedIn and Instagram, generating the carousel slides, and creating a review page where I can see both platform previews before anything goes live.

What Gary doesn't do is think. It doesn't have opinions, real experience, or skin in the game. That's where the interview step comes in.

Before Gary writes a single word, it asks me questions. Not generic ones — targeted questions based on the keyword research it ran before the conversation. What was the specific frustration? What would I tell someone starting from zero? What surprised me about building this? My answers are what make the content worth reading. Gary's job is to turn those answers into something well-structured, properly formatted, and ready to ship.

The result is content that sounds like me — because the thinking is mine. The execution is automated.

## The architecture, plainly

Here's what runs under the hood:

1. **Brief** — I describe the topic and core angle to Gary
2. **Research** — Gary runs keyword analysis via [DataForSEO](https://dataforseo.com) to find the right search terms and assess competition
3. **Interview** — Gary asks 5-7 targeted questions; I answer in plain language
4. **Generation** — Gary writes the blog post (full frontmatter, FAQs, proper structure) and drafts captions for both LinkedIn and Instagram
5. **Review** — Gary commits everything to a [private review page](https://www.benedictschweiger.com/review/) with native-style platform previews
6. **Approval** — I read through, check for false claims and flow, hit Approve
7. **Publish** — one function call: GitHub API flips the blog post from draft to live, Netlify rebuilds, Google Indexing API gets notified, and the social posts go out to LinkedIn and Instagram simultaneously. Telegram confirms it worked.

The whole thing from approval to live post takes under 60 seconds.

This works for carousels. It works equally well for plain text posts. The architecture doesn't care about format — it cares about moving content from idea to distribution without requiring me to operate every step manually.

## Where I actually sit in this process

Not at a desk writing. Not in Canva designing slides. At an approval gate.

When I review a post, I'm checking three things: does it make any false claims, does it flow well enough that I'd actually read it, and would it genuinely interest someone in my audience. If the answer to all three is yes, I approve. If something's off, I hit Revise and write one sentence of feedback — Gary rewrites and resubmits.

That's the whole job. Everything else is automated.

The important thing to understand about this model: the approval gate isn't where the content gets made. It's where bad content gets stopped. If I'm rewriting paragraphs at the approval step, the generation step failed. The bar is either "this is good enough to publish as-is" or "this needs to be regenerated." There's no in-between state where I become a human editor.

## What actually broke

Building this, I expected the technical parts to be the hard part. [LinkedIn's image upload API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api) is a separate call from the post creation API — most tutorials don't mention this. The [Instagram Graph API](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api) requires publicly accessible image URLs before you can create media containers. The Netlify edge function wouldn't read environment variables scoped only to regular functions. Small things, fixable things.

The harder constraint was creative. Templates are necessary for automation — Gary needs a consistent structure to work from. But templates limit variety. The carousels I can generate today follow a few formats. That's a narrower creative range than I'd choose if I were designing from scratch every time.

The solution is more templates, more variety. This is version one of a pipeline that will look very different in a year. I'm not bothered by the current constraints because I understand where they come from and how to address them. What I'm not willing to do is let perfect be the enemy of functional.

## Why personal input is non-negotiable

There's a version of this pipeline that skips the interview step entirely. Gary generates a brief from a topic keyword, writes the post, submits for approval. It's faster.

It also produces content that has no reason to exist.

The internet already has ten thousand articles about content automation. What it doesn't have is my specific experience building this at a company I've run marketing for since 2020, with the specific constraints of a bootstrapped operation, validated on my own setup before I trust it with a real business. That context is what makes a post original. That's what the interview extracts.

If the content isn't lasting and original, there's no point publishing it. The pipeline exists to scale the output of ideas that are worth scaling — not to manufacture volume for its own sake.

## What to do if you want to build this

You don't need to replicate my exact setup. The principle works at any level of technical sophistication.

The minimum viable version: an AI agent that asks you questions about a topic, turns your answers into a draft, and sends it to you for review before anything goes out. No LinkedIn API, no Instagram Graph API, no Netlify functions. Just a structured interview, a draft, and an approval step.

Build that first. See if the content quality is there. Then automate the distribution layer once you're confident in the generation.

And if you're not sure where to start? Ask Claude.

---

*This post was produced through the exact pipeline it describes. Gary interviewed me, wrote the draft based on my answers, and I approved it. The architecture diagram is in my head; the code is in [the repo](https://github.com/bs0601/benedictschweiger-com).*

*Want to understand where your marketing operation sits on the automation curve? [Take the Autonomy Score diagnostic →](/autonomy-score/)*
