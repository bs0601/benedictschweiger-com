---
title: "Before I Touch the €20M Business, I'm Running the Experiment on Myself"
date: 2026-04-27
slug: "before-i-touch-the-20m-business"
draft: false
description: "Most AI advice comes from people who have nothing to lose. I'm a CMO who can't afford that luxury. Here's how I'm building and validating an agentic stack before it touches the real business."
tags: ["agentic marketing", "AI infrastructure", "OpenClaw"]
---

Most AI advice comes from people who have nothing to lose.

They test a new tool on a demo dataset, write a thread about it, and call it a case study. The headline says "I replaced my team with AI." What they mean is they automated a side project with no revenue and no customers.

I'm a CMO. The business I run marketing for does about €20 million a year. If I make a significant mistake, I don't just look bad — I cost real people real money. That constraint changes how I think about deploying new technology.

So when I started getting serious about agentic AI, I made a decision: I build and validate everything on myself first. My own environment, my own data, my own workflows. No business risk. Full learning upside. Only when something proves itself in my personal setup does it become a candidate for the actual business.

That's what the last few weeks have been.

---

**The stack I've built**

The anchor is a Mac Studio M3 Ultra with 96GB of unified memory. That machine runs large language models locally — no API calls, no per-token costs, no data leaving the building. Right now it's running Gemma 4 (31B, Google's latest), Qwen 3.5 at 27B and 35B, and DeepSeek R1 at 70B for heavier reasoning tasks. The 70B model running locally on consumer hardware was unthinkable two years ago.

What surprised me: I'm not missing the hosted models much. Gemma 4 handles most daily work well enough that I'm not reaching for Claude by default anymore. That's a real shift.

On top of the local models, I'm running OpenClaw — an open-source AI operations platform that turns a language model into a persistent partner rather than a stateless chatbot. It has memory across sessions, access to my files, calendar, web search, and publishing tools. It can draft a blog post, commit it to GitHub, and push it live without me touching a terminal. It reads my past decisions before answering questions. It pushes back when I'm wrong.

The difference between this and "using ChatGPT" is roughly the difference between hiring a contractor for a one-off task and having a colleague who shows up every day, remembers what you talked about last week, and has context on what actually matters.

---

**What's live**

This website exists because of that stack. In the last few weeks:

- Built and launched benedictschweiger.com (Hugo + PaperMod, hosted on Netlify, auto-deploys from GitHub)
- Built the Autonomy Score diagnostic — a 15-question tool that tells marketers where they are on the path to agentic operations, with automated Brevo integration for follow-up
- Set up a LinkedIn publishing pipeline: I review drafts, approve, and my AI partner publishes via API
- Established a newsletter format and defined the content system around it
- Set up voice input workflows so I can think out loud and have the output captured, organized, and acted on

None of this required hiring. It took a few weeks of focused tinkering and a willingness to stay in the lab longer than felt comfortable.

---

**Why this order matters**

The business I work for has N8N automations, LLM integrations, a custom data warehouse, and a team that's already partly agentic. But what I'm running personally is more advanced than what's in production there, and that's deliberate.

Before you put a new type of engine in a car you depend on, you build something with that engine and learn how it fails. You find out where it breaks under load, what the edge cases are, what the failure modes look like. Then, with that knowledge, you make an informed decision about what to push into the real system.

The personal setup is the prototype. The business is the production environment. I'm not ready to move something to production until I understand it well enough to defend that decision.

This isn't caution for its own sake. It's the opposite. The faster I learn in the prototype environment, the faster and more confidently I can move in the real one. Tinkering here is what makes me bold there.

---

**What comes next**

A Mac Mini for the office — a dedicated node that runs the same stack in a business context without connecting it to the home network. A first round of business experiments with the tools that have proven themselves here. Documentation of what works and what breaks when it hits real scale and real stakes.

That's the whole arc. Build in private. Validate under controlled conditions. Push what survives to the real world. Document everything.

If you're a marketer or operator sitting on the fence about agentic AI — not because you're skeptical, but because you can't afford to get it wrong — that's exactly who this is for.

The lab is open.

---

*Hugo is my AI operations partner, running on OpenClaw. He helped draft this post, manages this site, and keeps the infrastructure running. He's part of the story, not a footnote.*
