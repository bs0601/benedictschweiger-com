/**
 * social-publish.js — handles approve action for social posts (type: "social").
 *
 * POST body: { slug, caption_linkedin, caption_instagram, images: ["/images/..."] }
 *
 * 1. Marks slug as dismissed in Netlify Blobs
 * 2. Posts carousel to LinkedIn (multi-image post)
 * 3. Posts carousel to Instagram (via Graph API)
 * 4. Sends Telegram confirmation
 * 5. Returns JSON result
 *
 * Required env vars:
 *   LINKEDIN_ACCESS_TOKEN   — OAuth token with w_member_social scope
 *   INSTAGRAM_GRAPH_API_TOKEN — Meta system user token
 *   INSTAGRAM_ACCOUNT_ID    — Instagram professional account ID
 *   GARY_TELEGRAM_BOT_TOKEN — Telegram bot token
 *   BENE_TELEGRAM_CHAT_ID   — Telegram chat ID
 *   REVIEW_PASSWORD         — Review auth password
 */

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

function isAuthorized(event) {
  const password = process.env.REVIEW_PASSWORD;
  if (!password) return true;
  const expected = crypto.createHash('sha256').update(password + 'review-salt-2026').digest('hex');
  const cookies = event.headers.cookie || '';
  return cookies.split(';').some(c => c.trim() === `review_auth=${expected}`);
}

const SITE_BASE = 'https://www.benedictschweiger.com';
const LINKEDIN_PERSON_URN = 'urn:li:person:ZQY1Q7S15J';

// --- LinkedIn API ---

async function uploadLinkedInImage(imageUrl, accessToken) {
  // 1. Initialize upload
  const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202502'
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: LINKEDIN_PERSON_URN
      }
    })
  });

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`LinkedIn initializeUpload failed (${initRes.status}): ${err}`);
  }

  const initData = await initRes.json();
  const uploadUrl = initData.value.uploadUrl;
  const imageUrn = initData.value.image;

  // 2. Fetch the image binary
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imageUrl}`);
  const imgBuffer = await imgRes.arrayBuffer();

  // 3. Upload binary to LinkedIn
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'image/png'
    },
    body: Buffer.from(imgBuffer)
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`LinkedIn image upload failed (${putRes.status}): ${err}`);
  }

  return imageUrn;
}

async function postToLinkedIn(captionLinkedin, images) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!accessToken) return { error: 'LINKEDIN_ACCESS_TOKEN not set' };

  try {
    // Upload all images
    const imageUrns = [];
    for (let i = 0; i < images.length; i++) {
      const fullUrl = `${SITE_BASE}${images[i]}`;
      const urn = await uploadLinkedInImage(fullUrl, accessToken);
      imageUrns.push(urn);
    }

    // Create multi-image post
    const postRes = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202502'
      },
      body: JSON.stringify({
        author: LINKEDIN_PERSON_URN,
        commentary: captionLinkedin,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        content: {
          multiImage: {
            images: imageUrns.map((urn, i) => ({
              id: urn,
              altText: `Slide ${i + 1}`
            }))
          }
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
      })
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      throw new Error(`LinkedIn post failed (${postRes.status}): ${err}`);
    }

    // LinkedIn returns 201 with x-restli-id header
    const postId = postRes.headers.get('x-restli-id') || 'created';
    return { published: true, postId };
  } catch (e) {
    console.error('LinkedIn error:', e.message);
    return { error: e.message };
  }
}

// --- Instagram Graph API ---

async function postToInstagram(captionInstagram, images) {
  const accessToken = process.env.INSTAGRAM_GRAPH_API_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!accessToken || !accountId) return { error: 'Instagram env vars not set' };

  try {
    // 1. Create carousel item containers
    const childIds = [];
    for (const imgPath of images) {
      const imageUrl = `${SITE_BASE}${imgPath}`;
      const res = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: accessToken
        })
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Instagram item container failed (${res.status}): ${err}`);
      }
      const data = await res.json();
      childIds.push(data.id);
    }

    // 2. Create carousel container
    const carouselRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        caption: captionInstagram,
        children: childIds.join(','),
        access_token: accessToken
      })
    });
    if (!carouselRes.ok) {
      const err = await carouselRes.text();
      throw new Error(`Instagram carousel container failed (${carouselRes.status}): ${err}`);
    }
    const carouselData = await carouselRes.json();

    // 3. Publish
    const publishRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carouselData.id,
        access_token: accessToken
      })
    });
    if (!publishRes.ok) {
      const err = await publishRes.text();
      throw new Error(`Instagram publish failed (${publishRes.status}): ${err}`);
    }
    const publishData = await publishRes.json();
    return { published: true, mediaId: publishData.id };
  } catch (e) {
    console.error('Instagram error:', e.message);
    return { error: e.message };
  }
}

// --- Main handler ---

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!isAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { slug, caption_linkedin, caption_instagram, images } = body;

  if (!slug || !images || !images.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing slug or images' }) };
  }

  // 1. Mark slug as dismissed in Blobs
  try {
    const store = getStore('review-dismissed');
    const raw = await store.get('dismissed-slugs');
    const existing = raw ? JSON.parse(raw) : [];
    if (!existing.includes(slug)) {
      existing.push(slug);
    }
    await store.set('dismissed-slugs', JSON.stringify(existing));
  } catch (e) {
    console.error('Blobs write error (non-fatal):', e.message);
  }

  // 2. Post to LinkedIn
  const linkedinResult = await postToLinkedIn(caption_linkedin || '', images);

  // 3. Post to Instagram
  const instagramResult = await postToInstagram(caption_instagram || '', images);

  // 4. Send Telegram confirmation
  const liStatus = linkedinResult.published ? '✅ Published' : `⚠️ ${linkedinResult.error}`;
  const igStatus = instagramResult.published ? '✅ Published' : `⚠️ ${instagramResult.error}`;
  const tgText = `📱 POSTED\nLinkedIn: ${liStatus}\nInstagram: ${igStatus}\nSlug: ${slug}`;

  try {
    await fetch(
      `https://api.telegram.org/bot${process.env.GARY_TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.BENE_TELEGRAM_CHAT_ID,
          text: tgText
        })
      }
    );
  } catch (e) {
    console.error('Telegram error (non-fatal):', e.message);
  }

  // 5. Return result
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      slug,
      linkedin: linkedinResult,
      instagram: instagramResult
    })
  };
};
