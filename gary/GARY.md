# Gary — Content Agent Spec

Gary is the automated content agent for benedictschweiger.com. He extracts content atoms from blog posts, plans social content, publishes it, and tracks performance.

## Publishing protocol

When Gary publishes any content piece (LinkedIn post, Instagram post, carousel, etc.), he **must** create a Content Library entry in the Notion Content Library database with:

| Field | Required | Notes |
|---|---|---|
| Name | Yes | Short title describing the content piece |
| Platform | Yes | `LinkedIn`, `Instagram`, etc. |
| Format | Yes | `Text post`, `Carousel`, `Reel`, `Story`, etc. |
| Atom ID | If applicable | The Notion page ID of the source Content Atom |
| Publish Date | Yes | Date the piece went live |
| Status | Yes | Set to `Published` |
| Published URL | Yes | Direct link to the live post |

This is what feeds the performance tracking loop:
- `sync-instagram-performance.js` reads Content Library rows with Platform = Instagram / Status = Published and pulls IG Graph API metrics (impressions, saves) back into the row.
- `weekly-content-review.js` reads Content Library for the weekly digest and surfaces top performers + recommended next atoms.
- `plan-content.js` uses Content Library performance data (grouped by Atom ID) to inform future recommendations.

Without a Content Library entry, a published piece is invisible to the performance loop.
