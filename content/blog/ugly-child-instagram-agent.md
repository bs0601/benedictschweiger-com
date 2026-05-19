---
title: "The First Marketing Role I Eliminated With an AI Agent"
date: 2026-05-19
slug: "first-marketing-role-eliminated-ai-agent"
draft: true
description: "How a €7M luxury watch retailer replaced an expensive Instagram manager with an AI agent — and why the channel everyone ignored became the proof that agentic marketing works."
author: "Benedict Schweiger"
tags:
  - "agentic marketing"
  - "AI team restructuring"
  - "marketing automation"
keywords:
  - "will AI replace marketing jobs"
  - "AI replacing marketing roles"
  - "marketing team automation"
  - "agentic marketing examples"
  - "AI Instagram automation"
cover:
  image: "/images/blog/first-marketing-role-eliminated-ai-agent-og.png"
  alt: "Abstract representation of an AI agent replacing a marketing role, with watch imagery"
  relative: false
hasFAQ: true
faq:
  - question: "Will AI replace marketing jobs?"
    answer: "AI will replace specific marketing tasks before it replaces entire roles. The first jobs at risk are repetitive, low-ROI activities like social media posting, basic reporting, and email sequencing. Strategic roles — brand positioning, creative direction, customer insight — remain human for now."
  - question: "What is an agentic workflow?"
    answer: "An agentic workflow is an automation system where an AI agent makes decisions rather than following rigid if-then rules. Unlike traditional automation, the agent can choose which tools to use, search for information, and adapt its output based on context."
  - question: "How much does it cost to build an AI agent for marketing?"
    answer: "The Instagram agent described in this article runs on a self-hosted N8n instance with OpenAI API calls. Total operating cost is under €50 per month — compared to the €3,000–€4,000 monthly salary of the role it replaced."
  - question: "What platforms support agentic workflows?"
    answer: "N8n is the platform used in this case study, chosen for its AI agent node that supports tool attachment and decision-making. Other options include Make.com (formerly Integromat) for simpler API-based workflows, and custom Python solutions for maximum flexibility."
  - question: "How do you identify which marketing roles to automate first?"
    answer: "Look for three signals: the work is repetitive and rules-based, the ROI is unclear or negative, and the channel exists because it's expected rather than because it drives results. These are your 'ugly children' — the roles that should be automated first."
---

**TL;DR**
- Instagram was ALTHERR's "ugly child" — a channel that existed because it was expected, not because it drove revenue.
- The person managing it cost €3,000–€4,000 per month. The ROI was negative. It was hygiene work dressed up as marketing.
- An AI agent built in N8n now chooses watch photos, researches each piece, writes captions, and posts daily — with no human in the loop.
- The agent has been running for over a year. Total cost: under €50 per month. The lesson is not about Instagram. It is about how to spot which roles in your marketing team are actually expensive hygiene.

---

Every marketing team has an ugly child.

Ours was Instagram. A luxury watch retailer with a €7M turnover, and our Instagram account was a chore. Not a channel. Not a growth engine. A chore. Something we carried along because we had to, because customers expect you to have one, because not having one would look like you had given up.

The person doing that chore was expensive. They were not doing bad work. They were doing work that did not matter enough to justify what we paid them. That is a different problem, and most businesses never face it directly.

This is the story of how we stopped carrying the ugly child — and what it taught us about which marketing roles agents should replace first.

---

## How do you know if a marketing role is actually just expensive hygiene?

The ugly child has three symptoms.

First, the channel exists because it is expected, not because it drives results. When I asked the team which platform brought engaged customers, the answer was always YouTube. Instagram was never mentioned unless someone said "we should probably post more."

Second, the work is repetitive and rules-based. Our Instagram manager followed the same pattern every day: choose a watch photo, write a caption, post at a certain time, respond to comments. There was no strategic decision-making in that loop. There was no creative leap. There was execution, and execution alone.

Third, the ROI is unclear or negative. We never ran the exact calculation, but the rough math was obvious. A €3,000–€4,000 monthly salary for a channel that contributed marginally to revenue, in a market where every euro of margin matters, is not a marketing investment. It is an expensive habit.

These three signals — expected presence, repetitive work, negative ROI — are the pattern. When you see all three in one role, you are not looking at marketing. You are looking at hygiene that someone has convinced you to call marketing.

---

## What is an agentic workflow, and why was N8n the right platform?

Before I explain what we built, I need to explain what changed in automation that made this possible.

We did not start with N8n. We started with Zapier, connecting HubSpot to our ERP system. Zapier worked, but it was expensive for the volume we needed, and it only handled basic connections — if this, then that. No decisions. No intelligence.

From Zapier we moved to Make.com, which allowed us to plug in API keys, including OpenAI's. That felt smarter. The workflows could use AI to generate text or make simple choices. But it was still, at core, a sequence of steps. The AI was a plugin, not the engine.

N8n was different. The German company had built something that looked like a workflow tool but behaved like an agent platform. The key was the AI agent node. Unlike other nodes, this one required you to attach a model, give it tools, and let it decide which tools to use.

The agent could search Google. It could retrieve data from HubSpot. It could read from a Google Drive folder. And it could decide, on its own, which of these actions to take based on the task at hand.

That is the difference between automation and agentic work. Automation follows a script. An agent reads the situation and chooses what to do.

---

## How did the Instagram agent actually work?

The build was simpler than the concept sounds.

We created a Google Drive folder and filled it with watch photos — hundreds of them, shot over years of trading. Every morning, the agent opens that folder and chooses one photo. Not randomly. It picks based on what has not been posted recently, what matches the current inventory, and what fits the day's implicit theme.

Then the agent researches the watch. It searches for the model, the reference number, the history. It pulls from our company knowledge base — the accumulated descriptions, pricing data, and brand stories we had built over years of trading.

With that context, it writes a caption. Not generic marketing fluff. A caption that sounds like someone who knows watches wrote it, because the agent is drawing from the same knowledge base our human team used.

Finally, it posts. The cadence is adjustable — two posts per day, three posts per day, whatever we need. We can add videos to the folder, and the agent will include them. We can pause the whole system with one toggle.

The agent has been running for over a year. It has never called in sick. It has never asked for a raise. It has never posted something that embarrassed the brand, because it only knows what we taught it.

---

## What happened to the person whose role was eliminated?

This is the question everyone asks, and it is the right question.

I will not pretend this was easy. The person was not fired. Their role was eliminated, which is a different thing, and they moved to other work within the business. But the work they were doing on Instagram stopped existing as a human task.

The uncomfortable truth is that many marketing roles are built on tasks that should not exist. Not because the people are bad, but because the work is mechanical and the value it creates does not justify the cost. When you automate that work, the role disappears. The person does not have to disappear with it, but the work does.

This is what I mean by the operator-to-architect shift. The people who remain in marketing teams will not be the ones who execute tasks. They will be the ones who design the systems that execute tasks. That requires a different skill set, and not everyone makes the transition.

---

## What marketing roles are most at risk from AI agents?

Based on what I have seen at ALTHERR and with clients, the roles that disappear first share the ugly child pattern.

Social media management for low-ROI channels is the obvious one. If a platform does not drive revenue and the work is repetitive, an agent can do it. Instagram was our example, but I have seen the same pattern with Twitter accounts that exist because "we should have one," and LinkedIn company pages that post corporate announcements to an audience of employees.

Basic reporting and dashboard maintenance is next. If someone spends half their week pulling data into a spreadsheet and formatting it for a Monday meeting, that work is already automatable. The value is not in the pulling. It is in the interpretation, and interpretation requires context that dashboards do not have.

Email sequencing and basic copywriting for transactional messages follow. The welcome sequence, the abandoned cart reminder, the post-purchase follow-up — these are not creative writing. They are pattern matching, and agents are already better at pattern matching than most humans.

What does not get replaced? Brand strategy. Creative direction. The decision about which channels to invest in and which to kill. The conversation with a customer that reveals something no survey captured. These require judgment, and judgment requires stakes.

---

## How much did the agent actually cost to build and run?

The build took approximately two weeks of my time, working alongside our technical team. The agent itself runs on a self-hosted N8n instance on our server, so there is no platform subscription beyond server costs we already had.

The ongoing cost is the OpenAI API usage for the agent's reasoning and text generation. For the volume of posts we generate, this runs under €50 per month.

Compare that to €3,000–€4,000 per month for the human role. The ROI is not close. It is not even in the same category.

But the real cost saving is not the salary. It is the attention. The mental overhead of managing a person doing work nobody believed in, of pretending a channel mattered when the numbers said it did not, of carrying the ugly child because it was expected — that attention is now free to go somewhere that actually moves the business.

---

## The operator-to-architect shift: what this means for your team

The Instagram agent was the first role we eliminated with AI. It was not the last.

What I learned from that first elimination is that the question is not "can AI do this?" The question is "should a human be doing this at all?" If the answer is no, then AI is not replacing a person. It is replacing a mistake — the mistake of assigning human attention to work that does not deserve it.

The marketing teams that survive this shift will not be smaller. They will be different. The people in them will not spend their days choosing photos and writing captions. They will spend their days deciding which channels deserve attention, which stories deserve telling, and which systems need to be built or rebuilt.

That is the operator-to-architect shift. It is not about doing less. It is about doing work that only humans can do — and letting agents handle the rest.

The ugly child taught me that. Instagram, of all things, was the proof that agentic marketing is not a future possibility. It is a present reality, and the teams that recognise it first will have an advantage that compounds.

---

*If you are evaluating which roles in your marketing team should be automated first, start with the ugly child. The one that exists because it is expected. The one that costs more than it returns. The one that nobody would miss if it disappeared tomorrow. That is where agents earn their place — not by replacing your best people, but by removing the work that never should have been theirs.*