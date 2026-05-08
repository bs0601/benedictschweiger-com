/**
 * validate-brief.js — Validates a carousel brief JSON against slide character limits.
 * Run before generating any carousel to catch overflow before it breaks the creative.
 *
 * Usage: node scripts/validate-brief.js gary/carousels/briefs/[slug].json
 */

const fs = require('fs');
const path = require('path');

const LIMITS = {
  hook:           { max: 80,  label: 'HOOK (slide 1, 50pt)'           },
  tension_label:  { max: 25,  label: 'TENSION_LABEL (slide 2, 30pt)'  },
  tension_body:   { max: 160, label: 'TENSION_BODY (slide 2, 28pt)'   },
  proof_label:    { max: 25,  label: 'PROOF_LABEL (slide 3, 30pt)'    },
  proof_body:     { max: 160, label: 'PROOF_BODY (slide 3, 28pt)'     },
  reframe:        { max: 80,  label: 'REFRAME (slide 4, 50pt)'        },
  cta_headline:   { max: 70,  label: 'CTA_HEADLINE (slide 5, 36pt)'   }
};

function validate(briefPath) {
  const abs = path.resolve(briefPath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }

  let brief;
  try {
    brief = JSON.parse(fs.readFileSync(abs, 'utf-8'));
  } catch (e) {
    console.error(`Invalid JSON: ${e.message}`);
    process.exit(1);
  }

  const slides = brief.slides || {};
  const errors = [];
  const warnings = [];

  for (const [key, rule] of Object.entries(LIMITS)) {
    const value = slides[key];
    if (!value) {
      warnings.push(`  ⚠️  ${rule.label}: missing`);
      continue;
    }
    const len = value.length;
    const pct = Math.round((len / rule.max) * 100);
    if (len > rule.max) {
      errors.push(`  ❌ ${rule.label}: ${len} chars (limit ${rule.max}, over by ${len - rule.max})`);
      errors.push(`     "${value.slice(0, 60)}..."`);
    } else if (pct >= 90) {
      warnings.push(`  ⚠️  ${rule.label}: ${len}/${rule.max} chars (${pct}% — close to limit)`);
    } else {
      console.log(`  ✅ ${rule.label}: ${len}/${rule.max} chars`);
    }
  }

  if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach(w => console.log(w));
  }

  if (errors.length) {
    console.log('\nErrors — brief rejected:');
    errors.forEach(e => console.log(e));
    console.log('\nShorten the fields above before generating slides.');
    process.exit(1);
  }

  console.log(`\n✅ Brief "${brief.id}" is valid. Safe to generate.`);
}

const briefPath = process.argv[2];
if (!briefPath) {
  console.error('Usage: node scripts/validate-brief.js gary/carousels/briefs/[slug].json');
  process.exit(1);
}

validate(briefPath);
