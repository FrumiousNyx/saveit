[OPEN]

# Debug Session: instagram-jpg-download

## Problem
- Actual: submitting an Instagram reel/video link still resolves to an image URL and downloads a JPG.
- Expected: video links should resolve to a video media URL and download as a video file.

## Reproduction
1. Start the app locally.
2. Paste an Instagram reel/video URL into the downloader.
3. Submit the form.
4. Observe that the result card shows an image media item and the download saves as JPG.

## Notes
- Focus area is the resolve pipeline in `app/api/resolve/route.ts`.
- Runtime evidence is required before changing business logic again.

## Hypotheses
- A: Instagram HTML for the failing link has no video field, so the resolver falls back to image metadata.
- B: The HTML contains a video URL, but the current extraction patterns miss the actual field name or escaping.
- C: Server-side fetch receives a generic/login/preview page that lacks real media metadata.
- D: `/api/resolve` returns video correctly, but the later download step or content-type handling turns it into JPG.
- E: The post type is a carousel/clip preview where the extracted asset is an image rather than the reel video.

## Instrumentation
- Added runtime debug points in `app/api/resolve/route.ts` for:
  - Instagram oEmbed response
  - Instagram page fetch response
  - HTML extraction signals
  - Final extracted media selection

## Evidence
- Local reproduction against `https://www.instagram.com/reel/DZU1WG_C3h9/` returned no media.
- Logged signals showed:
  - `status=200` with `contentType=text/html`
  - no `og:video`, `video_url`, `contentUrl`, `video_versions`, or `og:image`
  - extracted `videoUrl=null`, `imageUrl=null`
- This supports C for that sample URL, but it does not yet explain the user-visible case where the UI returns an image card.

## Confirmed Reproduction
- Exact failing link from user: `https://www.instagram.com/reel/DZUtWG_C3h9/`
- Pre-fix logs for the exact link showed:
  - main reel page had `og:image` but no direct video fields
  - resolver selected the JPG preview URL as `image`
  - embed page fetch succeeded and contained `.mp4`, but the video lived inside escaped JSON

## Hypothesis Status
- A: Confirmed for the main reel page. It exposed image metadata and no direct video field.
- B: Confirmed. The embed page carried the real video in escaped JSON, and the old extractor missed that form.
- C: Rejected as the sole root cause for the exact failing link. The main page was limited, but the embed page still exposed usable media.
- D: Rejected. `/api/resolve` itself was returning `image`, so the bug was upstream of `/api/download`.
- E: Inconclusive / not needed for this fix.

## Fix
- Added Instagram embed-page fallback when the normal reel page has no video URL.
- Expanded Instagram extraction regexes to support escaped JSON keys such as `\"video_url\":\"...\"`.
- Normalized escaped slashes in extracted URLs so the returned media link is a clean downloadable video URL.

## Verification
- Local post-fix verification for `https://www.instagram.com/reel/DZUtWG_C3h9/` now returns:
  - `media[0].type = "video"`
  - `media[0].url` ending in `.mp4`
