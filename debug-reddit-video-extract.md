[OPEN]

# Debug Session: reddit-video-extract

## Problem
- Actual: a Reddit video link returns `Could not extract media from Reddit. The link may be private or invalid.`
- Expected: the app should resolve the Reddit post into a downloadable video media URL.

## Reproduction
1. Start the app locally.
2. Paste `https://www.reddit.com/r/GymMemes/comments/1tpj7k1/was_not_expecting_that/`.
3. Submit the form.
4. Observe the Reddit extraction failure message.

## Scope
- Focus on the Reddit resolve flow in `app/api/resolve/route.ts`.
- Collect runtime evidence before modifying business logic.

## Hypotheses
- A: Reddit’s `.json` response shape for this post uses fields the resolver does not inspect.
- B: The post is Reddit-hosted video, but the usable media URL must be derived from a different source than `.json`.
- C: The `.json` request is blocked before parsing, so the current resolver never receives post data.
- D: The post is a crosspost or nested post shape, and media lives under a different object.
- E: The downloader works, but `/api/resolve` rejects valid media too early.

## Evidence
- Pre-fix instrumentation showed the current JSON request returned:
  - `status=403`
  - `contentType=text/html`
  - no Reddit post data was parsed
- Manual follow-up checks showed:
  - `www.reddit.com/.../.json` and `old.reddit.com/.../.json` both returned `403`
  - `old.reddit.com/.../` returned `200` with HTML for the exact thread
  - the old Reddit HTML exposed `data-hls-url` and `data-mpd-url`
  - the MPD manifest exposed video representations including `CMAF_720.mp4`

## Hypothesis Status
- A: Rejected for this specific failure. The issue occurs before JSON parsing.
- B: Confirmed. The usable media is available through old Reddit HTML and the MPD manifest.
- C: Confirmed. The `.json` endpoint is blocked with `403`.
- D: Rejected for this failure path.
- E: Rejected. `/api/download` works once `/api/resolve` returns a valid Reddit video URL.

## Fix
- Kept the existing JSON path first.
- Added an `old.reddit.com` HTML fallback when JSON is blocked or yields no media.
- Parsed `data-mpd-url` / `data-hls-url` from old Reddit HTML.
- Resolved the best available video representation from the MPD manifest and returned a direct `.mp4`.

## Verification
- Local verification for `https://www.reddit.com/r/GymMemes/comments/1tpj7k1/was_not_expecting_that/` now returns:
  - `platform = "reddit"`
  - `media[0].type = "video"`
  - `media[0].url = "https://v.redd.it/co3cjyykzq3h1/CMAF_720.mp4"`
- Download verification via `/api/download` returned:
  - `Content-Type: video/mp4`
  - `Content-Disposition: attachment; filename="download.mp4"`
