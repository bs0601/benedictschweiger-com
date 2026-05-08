/**
 * extract-atoms.js — Extract content atoms from a blog post via Kimi API,
 * then write them to the Notion Content Atoms database.
 *
 * Usage: node scripts/extract-atoms.js content/blog/[slug].md
 */

const fs = require('fs');
const path = require('path');

const NOTION_API_KEY = fs.readFileSync(
  path.join(process.env.HOME, '.config/notion/api_key'), 'utf-8'
).trim();
const NOTION_DB_ID = 'bebed412-7c8d-4ed9-881f-fb3aacc8c4f4';
const GEMINI_API_KEY = (() => {
  try {
    const env = fs.readFileSync(
      path.join(process.env.HOME, '.openclaw/workspace/memory/credentials.env'), 'utf-8'
    );
    const match = env.match(/^GEMINI_API_KEY=(.+)$/m);
    return match ? match[1].trim() : process.env.GEMINI_API_KEY;
  } catch { return process.env.GEMINI_API_KEY; }
})();
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/extract-atoms.js content/blog/[slug].md');
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, 'utf-8');

  // Parse frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.error('No frontmatter found');
    process.exit(1);
  }
  const frontmatter = fmMatch[1];
  const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const slugMatch = frontmatter.match(/^slug:\s*["']?(.+?)["']?\s*$/m);
  const title = titleMatch ? titleMatch[1] : path.basename(filePath, '.md');
  const slug = slugMatch ? slugMatch[1] : path.basename(filePath, '.md');

  // Strip frontmatter from content
  const content = raw.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();

  // Call Ollama
  const prompt = `You are extracting content atoms from a blog post for use in social media content.

An "atom" is a discrete, self-contained insight from this article that could stand alone as a social post. Extract 6-10 atoms. Each atom should be:
- 1-2 sentences maximum
- A complete thought someone could share without needing the full article
- Genuinely interesting or surprising

For each atom, determine:
- type: one of [quote, framework, data, decision, take, provocation]
  - quote: a memorable, quotable sentence from the article
  - framework: a named concept, process, or mental model
  - data: a specific number, percentage, or measurable result
  - decision: a choice made and why (especially contrarian choices)
  - take: an opinion or perspective
  - provocation: something that challenges a common assumption
- platform_fit: array from [LinkedIn text, Carousel, Instagram]
  - LinkedIn text: works as a standalone text post with a quote card
  - Carousel: could be expanded into a multi-slide visual
  - Instagram: punchy enough for a visual caption

Return ONLY valid JSON, no commentary:
{
  "atoms": [
    {
      "text": "The atom text here",
      "type": "take",
      "platform_fit": ["LinkedIn text", "Instagram"]
    }
  ]
}

Article title: ${title}
Article content:
${content}`;

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not set.');
    process.exit(1);
  }

  let geminiResponse;
  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Gemini API error ${res.status}: ${errText}`);
      process.exit(1);
    }
    geminiResponse = await res.json();
  } catch (err) {
    console.error(`Gemini API request failed: ${err.message}`);
    process.exit(1);
  }

  const rawText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip markdown code fences if present
  let jsonStr = rawText.trim();
  jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();

  let atoms;
  try {
    const parsed = JSON.parse(jsonStr);
    atoms = parsed.atoms;
    if (!Array.isArray(atoms)) throw new Error('atoms is not an array');
  } catch (err) {
    console.error(`Failed to parse Ollama JSON: ${err.message}`);
    console.error('Raw response:', rawText.slice(0, 500));
    process.exit(1);
  }

  // Write each atom to Notion
  let created = 0;
  for (const atom of atoms) {
    const body = {
      parent: { database_id: NOTION_DB_ID },
      properties: {
        'Atom': { title: [{ text: { content: atom.text } }] },
        'Source Slug': { rich_text: [{ text: { content: slug } }] },
        'Source Title': { rich_text: [{ text: { content: title } }] },
        'Type': { select: { name: atom.type } },
        'Platform Fit': { multi_select: (atom.platform_fit || []).map(p => ({ name: p })) },
        'Times Used': { number: 0 },
        'Status': { select: { name: 'active' } }
      }
    };

    try {
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`Notion API error for atom "${atom.text.slice(0, 40)}...": ${err}`);
        continue;
      }
      created++;
    } catch (err) {
      console.error(`Notion request failed: ${err.message}`);
    }
  }

  console.log(`Extracted ${created} atoms from ${slug} → Notion`);
}

main();
