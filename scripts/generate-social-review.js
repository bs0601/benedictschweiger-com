#!/usr/bin/env node
/**
 * generate-social-review.js — generates a review page for a social post.
 *
 * Usage: node scripts/generate-social-review.js static/review/pending.json carousel-slug-here
 *
 * Reads the entry from pending.json by slug and generates
 * static/review/[slug]/index.html with LinkedIn + Instagram previews.
 */

const fs = require('fs');
const path = require('path');

const [,, pendingPath, slug] = process.argv;

if (!pendingPath || !slug) {
  console.error('Usage: node scripts/generate-social-review.js <pending.json> <slug>');
  process.exit(1);
}

const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf-8'));
const entry = pending.find(e => e.slug === slug);

if (!entry) {
  console.error(`Slug "${slug}" not found in ${pendingPath}`);
  process.exit(1);
}

if (entry.type !== 'social') {
  console.error(`Entry "${slug}" is type "${entry.type}", expected "social"`);
  process.exit(1);
}

const outDir = path.join(path.dirname(pendingPath), slug);
fs.mkdirSync(outDir, { recursive: true });

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
}

const images = entry.images || [];
const captionLinkedin = entry.caption_linkedin || '';
const captionInstagram = entry.caption_instagram || '';
const slideCount = images.length;

const imageTagsLinkedin = images.map((src, i) =>
  `<img src="${escapeHtml(src)}" alt="Slide ${i + 1}" style="height:260px;width:auto;flex-shrink:0;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.18)">`
).join('\n        ');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Review: ${escapeHtml(entry.title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; background: #F5F4F0; color: #1a1a1a; min-height: 100vh; }
  .top-bar { background: #1a1a1a; color: #fff; padding: 14px 24px; display: flex; align-items: center; gap: 12px; }
  .top-bar a { color: #aaa; text-decoration: none; font-size: 13px; }
  .top-bar a:hover { color: #fff; }
  .top-bar h2 { font-size: 15px; font-weight: 600; flex: 1; }
  .badge { font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; }
  .badge-social { background: #fef3e2; color: #e65100; }
  .content-area { max-width: 900px; margin: 0 auto; padding: 32px 24px 120px; }
  .platform-section { margin-bottom: 40px; }
  .platform-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #888; margin-bottom: 12px; }

  /* LinkedIn preview */
  .li-card { background: #fff; border-radius: 8px; border: 1px solid #e0e0e0; max-width: 560px; overflow: hidden; }
  .li-header { display: flex; align-items: flex-start; padding: 16px 16px 0; gap: 10px; }
  .li-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .li-meta { flex: 1; }
  .li-name { font-size: 14px; font-weight: 700; color: #000; }
  .li-name .li-degree { font-weight: 400; color: #666; font-size: 13px; }
  .li-headline { font-size: 12px; color: #666; line-height: 1.3; }
  .li-time { font-size: 12px; color: #999; margin-top: 1px; }
  .li-follow { background: none; border: none; color: #0a66c2; font-size: 14px; font-weight: 700; cursor: default; padding: 4px 0; white-space: nowrap; }
  .li-caption { padding: 12px 16px 0; font-size: 14px; line-height: 1.5; color: #000; white-space: pre-wrap; word-wrap: break-word; }
  .li-carousel { display: flex; gap: 10px; overflow-x: auto; padding: 12px 16px; scrollbar-width: thin; scroll-snap-type: x mandatory; }
  .li-carousel img { height: 260px; width: auto; flex-shrink: 0; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,.18); scroll-snap-align: start; }
  .li-actions { display: flex; border-top: 1px solid #e0e0e0; padding: 4px 0; }
  .li-actions button { flex: 1; background: none; border: none; padding: 12px 0; font-size: 13px; font-weight: 600; color: #666; cursor: default; }

  /* Instagram preview */
  .ig-card { background: #fff; border-radius: 8px; border: 1px solid #dbdbdb; max-width: 400px; overflow: hidden; }
  .ig-top { display: flex; align-items: center; padding: 12px; gap: 10px; }
  .ig-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
  .ig-username { font-size: 14px; font-weight: 600; color: #262626; flex: 1; }
  .ig-menu { font-size: 18px; color: #262626; cursor: default; letter-spacing: 2px; }
  .ig-viewer { position: relative; width: 100%; aspect-ratio: 1/1; background: #000; overflow: hidden; }
  .ig-viewer img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity .2s; }
  .ig-viewer img.active { opacity: 1; }
  .ig-tap { position: absolute; top: 0; bottom: 0; width: 50%; cursor: pointer; z-index: 2; }
  .ig-tap-left { left: 0; }
  .ig-tap-right { right: 0; }
  .ig-dots { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; z-index: 3; }
  .ig-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.4); }
  .ig-dot.active { background: #0095f6; }
  .ig-icons { display: flex; align-items: center; padding: 12px; gap: 14px; }
  .ig-icons span { font-size: 22px; cursor: default; }
  .ig-icons .ig-save { margin-left: auto; }
  .ig-caption-area { padding: 0 12px 12px; font-size: 14px; line-height: 1.5; color: #262626; }
  .ig-caption-area .ig-cap-user { font-weight: 600; }
  .ig-comments { padding: 0 12px 12px; font-size: 13px; color: #999; }

  /* Approval bar */
  .approval-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e5e5e5; padding: 16px 24px; display: flex; gap: 12px; align-items: flex-end; z-index: 100; box-shadow: 0 -4px 24px rgba(0,0,0,.08); }
  .approval-bar .inner { max-width: 900px; margin: 0 auto; width: 100%; display: flex; gap: 12px; align-items: flex-end; }
  .feedback-wrap { flex: 1; }
  .feedback-wrap label { font-size: 11px; font-weight: 700; color: #888; letter-spacing: .06em; text-transform: uppercase; display: block; margin-bottom: 6px; }
  .feedback-wrap textarea { width: 100%; border: 1.5px solid #e5e5e5; border-radius: 8px; padding: 10px 12px; font-size: 13px; font-family: inherit; resize: vertical; min-height: 44px; max-height: 120px; outline: none; color: #1a1a1a; transition: border-color .15s; }
  .feedback-wrap textarea:focus { border-color: #C4622D; }
  .btn { border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; padding: 12px 20px; white-space: nowrap; transition: opacity .15s; }
  .btn:hover { opacity: .85; }
  .btn-approve { background: #2a7a4e; color: #fff; }
  .btn-revise { background: #fef3e2; color: #e65100; border: 1.5px solid #e65100; }
  .toast { position: fixed; top: 24px; right: 24px; background: #1a1a1a; color: #fff; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; opacity: 0; transition: opacity .3s; pointer-events: none; z-index: 200; }
  .toast.show { opacity: 1; }
</style>
</head>
<body>
<div class="top-bar">
  <a href="/review/">\u2190 All drafts</a>
  <h2>${escapeHtml(entry.title)}</h2>
  <span class="badge badge-social">social</span>
</div>
<div class="toast" id="toast"></div>
<div class="content-area">

  <!-- LinkedIn Preview -->
  <div class="platform-section">
    <div class="platform-label">LinkedIn Preview</div>
    <div class="li-card">
      <div class="li-header">
        <img class="li-avatar" src="/images/og-default.png" alt="Avatar">
        <div class="li-meta">
          <div class="li-name">Benedict Schweiger <span class="li-degree">\u00b7 1st</span></div>
          <div class="li-headline">Head of Marketing at ALTHERR</div>
          <div class="li-time">Just now \u00b7 \ud83c\udf10</div>
        </div>
        <span class="li-follow">+ Follow</span>
      </div>
      <div class="li-caption">${escapeHtml(captionLinkedin)}</div>
      <div class="li-carousel">
        ${imageTagsLinkedin}
      </div>
      <div class="li-actions">
        <button>\ud83d\udc4d Like</button>
        <button>\ud83d\udcac Comment</button>
        <button>\ud83d\udd01 Repost</button>
        <button>\u2708\ufe0f Send</button>
      </div>
    </div>
  </div>

  <!-- Instagram Preview -->
  <div class="platform-section">
    <div class="platform-label">Instagram Preview</div>
    <div class="ig-card">
      <div class="ig-top">
        <img class="ig-avatar" src="/images/og-default.png" alt="Avatar">
        <span class="ig-username">benedictschweiger</span>
        <span class="ig-menu">\u2026</span>
      </div>
      <div class="ig-viewer" id="igViewer">
        ${images.map((src, i) => `<img src="${escapeHtml(src)}" alt="Slide ${i + 1}" class="${i === 0 ? 'active' : ''}" data-idx="${i}">`).join('\n        ')}
        <div class="ig-tap ig-tap-left" onclick="igNav(-1)"></div>
        <div class="ig-tap ig-tap-right" onclick="igNav(1)"></div>
        <div class="ig-dots">
          ${images.map((_, i) => `<div class="ig-dot ${i === 0 ? 'active' : ''}" data-dot="${i}"></div>`).join('\n          ')}
        </div>
      </div>
      <div class="ig-icons">
        <span>\u2764\ufe0f</span>
        <span>\ud83d\udde8\ufe0f</span>
        <span>\ud83d\udce4</span>
        <span class="ig-save">\ud83d\udd16</span>
      </div>
      <div class="ig-caption-area">
        <span class="ig-cap-user">benedictschweiger</span> ${escapeHtml(captionInstagram)}
      </div>
      <div class="ig-comments">View all 0 comments</div>
    </div>
  </div>

</div>

<div class="approval-bar">
  <div class="inner">
    <div class="feedback-wrap">
      <label>Feedback / revision notes</label>
      <textarea id="feedback" placeholder="Optional \u2014 leave blank to approve as-is\u2026" rows="2"></textarea>
    </div>
    <button class="btn btn-revise" onclick="sendDecision('revise')">\ud83d\udd04 Request revision</button>
    <button class="btn btn-approve" onclick="sendDecision('approve')">\u2705 Approve & post</button>
    <button class="btn" onclick="sendDecision('delete')" title="Remove from pipeline" style="background:#f5f5f5;color:#888;border:1.5px solid #ddd">\ud83d\uddd1 Delete</button>
  </div>
</div>

<script>
// Instagram carousel navigation
let igIdx = 0;
const igTotal = ${slideCount};

function igNav(dir) {
  igIdx = Math.max(0, Math.min(igTotal - 1, igIdx + dir));
  document.querySelectorAll('#igViewer img').forEach(img => img.classList.remove('active'));
  document.querySelector('#igViewer img[data-idx="' + igIdx + '"]').classList.add('active');
  document.querySelectorAll('.ig-dot').forEach(d => d.classList.remove('active'));
  document.querySelector('.ig-dot[data-dot="' + igIdx + '"]').classList.add('active');
}

// Approval actions
async function sendDecision(action) {
  const feedback = document.getElementById('feedback').value.trim();
  const slug = '${escapeJs(slug)}';
  const toast = document.getElementById('toast');

  if (action === 'revise' && !feedback) {
    document.getElementById('feedback').focus();
    document.getElementById('feedback').style.borderColor = '#e65100';
    return;
  }

  // Approve goes to social-publish; revise/delete go to content-approval
  if (action === 'approve') {
    toast.textContent = 'Posting to LinkedIn + Instagram...';
    toast.classList.add('show');
    document.querySelectorAll('.btn').forEach(b => b.disabled = true);

    try {
      const res = await fetch('/.netlify/functions/social-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug,
          caption_linkedin: ${JSON.stringify(captionLinkedin)},
          caption_instagram: ${JSON.stringify(captionInstagram)},
          images: ${JSON.stringify(images)}
        })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const liStatus = data.linkedin?.error ? '\\u26a0\\ufe0f LI: ' + data.linkedin.error : '\\u2705 LinkedIn';
        const igStatus = data.instagram?.error ? '\\u26a0\\ufe0f IG: ' + data.instagram.error : '\\u2705 Instagram';
        toast.textContent = liStatus + ' | ' + igStatus;
        setTimeout(() => { window.location.href = '/review/'; }, 2500);
      } else {
        toast.textContent = '\\u26a0\\ufe0f ' + (data.error || 'Something went wrong');
        document.querySelectorAll('.btn').forEach(b => b.disabled = false);
        setTimeout(() => { toast.classList.remove('show'); }, 4000);
      }
    } catch (e) {
      toast.textContent = '\\u26a0\\ufe0f Network error';
      document.querySelectorAll('.btn').forEach(b => b.disabled = false);
      setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }
  } else {
    // revise or delete → content-approval
    const res = await fetch('/.netlify/functions/content-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, slug, type: 'social', feedback })
    });

    if (res.ok) {
      if (action === 'delete') {
        toast.textContent = '\\ud83d\\uddd1 Removed from pipeline.';
        toast.classList.add('show');
        document.querySelectorAll('.btn').forEach(b => b.disabled = true);
        setTimeout(() => { window.location.href = '/review/'; }, 1200);
      } else {
        toast.textContent = '\\ud83d\\udd04 Revision requested \\u2014 Gary will follow up.';
        toast.classList.add('show');
        document.querySelectorAll('.btn').forEach(b => b.disabled = true);
        setTimeout(() => { toast.classList.remove('show'); }, 4000);
      }
    } else {
      toast.textContent = '\\u26a0\\ufe0f Something went wrong. Try again.';
      toast.classList.add('show');
      setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }
  }
}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`✅ Review page generated: ${path.join(outDir, 'index.html')}`);
