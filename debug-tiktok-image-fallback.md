[OPEN]

# Debug Session: tiktok-image-fallback

## Problem
- Actual: some TikTok video links still resolve to an image and download as an image instead of a video.
- Expected: TikTok video links should resolve to a video media URL and download as a video file.

## Reproduction
1. Start the app locally.
2. Paste a failing TikTok link.
3. Submit the form.
4. Observe that the result card shows `Image` instead of `Video`.

## Scope
- Focus on the TikTok resolve flow in `app/api/resolve/route.ts`.
- Collect runtime evidence before changing business logic.
