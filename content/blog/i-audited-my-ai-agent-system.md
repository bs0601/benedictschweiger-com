---
title: "I Audited My AI Agent System. Now It Audits Itself."
date: 2026-05-15
slug: "i-audited-my-ai-agent-system"
draft: false
description: "Conflicting instructions don't break AI agents — they make output unreliable. One-time fixes rot. Living systems need scheduled maintenance."
author: "Benedict Schweiger"
tags: ["agentic marketing", "AI operations", "system design"]
keywords: ["AI agent audit", "marketing automation", "system maintenance"]
cover:
  image: "/images/blog/i-audited-my-ai-agent-system-og.png"
  alt: "System architecture diagram showing feedback loops"
  relative: false
hasFAQ: true
faq:
  - question: "How often should you audit an AI agent system?"
    answer: "Weekly at minimum. Daily if the system is generating customer-facing output. The audit checks for contradictions between instruction files, duplicate databases, and skills that have grown too large to be read reliably."
  - question: "What tools do you need to audit an agent system?"
    answer: "A second agent with read access to the same files, running a different model. I use Hugo (Kimi K2.6) to audit his own system, then cross-check with Claude Opus 4.7. The disagreement between models is where the problems hide."
  - question: "Can't you just write better instructions from the start?"
    answer: "No. The system changes faster than the documentation. A rule that made sense in week three contradicts a rule added in week seven. The only fix is continuous reconciliation."
  - question: "What happens if you skip the audit?"
    answer: "Output drifts. Not dramatically — that's the danger. A LinkedIn post uses five bullets instead of three. A carousel brief exceeds character limits. A validation rule references a deprecated file path. Small errors compound into unreliable output."
  - question: "How do I know if my marketing team needs an agent system audit?"
    answer: "Check your last ten pieces of output. Are they consistent in format, voice, and structure? Or do some follow different rules than others? If you find variation you didn't intend, you have drift."
---

## TL;DR

- Conflicting instructions don't break AI agents — they make output unreliable
- One-time fixes rot. Living systems need scheduled maintenance
- I built a weekly audit into the system — and you should too

---

Hugo drafted a blog post last week with five bullets in the TL;DR. The style guide says three. I didn't catch it. Neither did he.

The post went out. It was fine. Nobody complained. But the system had drifted — one file said three bullets, another said five, and the agent followed the one it read first. This is how technical debt accumulates in agentic systems: not with errors, but with inconsistencies that don't look like errors until they compound.

I spent the next two days auditing the architecture.

## What the audit found

The system had grown over six weeks. Six agents, fourteen skills, seven config files, three databases. Each addition made sense in isolation. Together, they contradicted each other.

**The TL;DR rules** — one file specified three bullets, another five. Hugo had been switching between them depending on which file loaded first.

**The LinkedIn workflow** — documented in two places with different steps. One mentioned validation, the other didn't. Some posts were checked, others weren't.

**The skills** — bundled too large. A single "content-pipeline" skill tried to cover blog posts, LinkedIn, carousels, and atom extraction. Agents couldn't find the specific instruction they needed, so they guessed.

**The databases** — three sources tracking the same content state. Notion, local JSON, and a Google Sheet. They disagreed on what was published, what was pending, what was approved.

None of this was broken. The system was working well enough to hide the contradictions. That's the scariest part.

## How we fixed it

I had Hugo audit his own system. He read every instruction file, every config, every skill. Listed the contradictions. Then I cross-checked with Claude Opus 4.7 — a different model, different training, different biases. The gaps they agreed on were real. The gaps they disagreed on were ambiguous.

We deleted code. Retired two databases. Consolidated four skills into twelve smaller ones — each with a single job, clear boundaries, and explicit dependencies.

Then we added a layer I should have built from the start: feedback loops.

Every output now gets checked against the rules that produced it. If a post has five bullets, the system flags it. If a skill references a deprecated file, the system flags it. If two config files contradict each other, the system flags it.

The flags don't fix the problem automatically. They surface it. A human — me or Hugo — decides what to do.

## The weekly audit

I built the audit into the system itself. It runs every Monday at 7 AM and checks four things:

1. **Contradictions** — do any two instruction files disagree?
2. **Bloat** — have any skills grown beyond a readable size?
3. **Orphans** — are there databases, files, or rules nothing references anymore?
4. **Drift** — has any output in the last week violated a rule?

It takes four minutes. It produces a one-page report. I read it over coffee.

This is the maintenance schedule I should have built on day one. Any living system needs it. The difference between a tool and a system is that a system maintains itself.

## The uncomfortable truth

I thought I was building an agentic marketing operation. What I actually built was a garden — something that grows, changes, and rots if you don't tend it.

The agents are not the system. The system is the maintenance. The agents are just the components.

If your marketing team is adding AI tools without scheduling time to reconcile the rules those tools follow, you're not building a system. You're accumulating drift.

The system is only as good as its last audit.

---

*Not sure where your marketing operation stands? The [Autonomy Score](/autonomy-score/) benchmarks your team against 200+ premium e-commerce businesses — and shows you exactly what to fix first.*
