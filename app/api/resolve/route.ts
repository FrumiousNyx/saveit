import { type NextRequest, NextResponse } from "next/server"
import { detectPlatform, isValidUrl, PLATFORM_LABELS } from "@/lib/platforms"

export type MediaItem = {
  type: "video" | "image"
  // Proxied/resolved media URL the client can open or download
  url: string
  thumbnail?: string
}

export type ResolveResult = {
  platform: string
  title: string
  author?: string
  duration?: string
  media: MediaItem[]
}

const REDDIT_USER_AGENT = "social-media-downloader/0.1 (by /u/anonymous_local_debug)"
const TIKTOK_DEBUG_SESSION = "tiktok-image-fallback"

/**
 * NOTE: This route validates and detects the source, then returns a structured response.
 * Reddit uses their public JSON endpoint. Instagram and TikTok use oEmbed APIs and
 * HTML parsing to extract media URLs.
 */
export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const url = (body.url ?? "").trim()

  if (!url || !isValidUrl(url)) {
    return NextResponse.json({ error: "Please enter a valid link." }, { status: 400 })
  }

  const platform = detectPlatform(url)
  if (!platform) {
    return NextResponse.json(
      { error: "We only support Instagram, Reddit, and TikTok links." },
      { status: 422 },
    )
  }

  try {
    if (platform === "reddit") {
      const result = await resolveReddit(url)
      if (result) return NextResponse.json(result)
    } else if (platform === "instagram") {
      const result = await resolveInstagram(url)
      if (result) return NextResponse.json(result)
    } else if (platform === "tiktok") {
      const result = await resolveTikTok(url)
      if (result) return NextResponse.json(result)
    }
  } catch (error) {
    console.error(`Error resolving ${platform}:`, error)
  }

  return NextResponse.json(
    {
      error: `Could not extract media from ${PLATFORM_LABELS[platform]}. The link may be private or invalid.`,
      platform,
    },
    { status: 422 },
  )
}

async function resolveReddit(url: string): Promise<ResolveResult | null> {
  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`
  const u = new URL(withProtocol)
  // Reddit serves post data as JSON by appending .json
  const jsonUrl = `${u.origin}${u.pathname.replace(/\/$/, "")}.json`

  const res = await fetch(jsonUrl, {
    headers: { "User-Agent": REDDIT_USER_AGENT },
    cache: "no-store",
  })
  if (!res.ok) return resolveRedditFromOldReddit(withProtocol)

  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) return resolveRedditFromOldReddit(withProtocol)
  const post = (data[0] as any)?.data?.children?.[0]?.data
  if (!post) return resolveRedditFromOldReddit(withProtocol)

  const media = extractRedditMedia(post)

  if (!media.length) return resolveRedditFromOldReddit(withProtocol)

  return {
    platform: "reddit",
    title: String(post.title ?? "Reddit post") || "Reddit post",
    author: post.author ? `u/${post.author}` : undefined,
    media,
  }
}

function extractRedditMedia(post: any): MediaItem[] {
  const media: MediaItem[] = []
  const seen = new Set<string>()

  const pushMedia = (item: MediaItem | null) => {
    if (!item?.url || seen.has(item.url)) return
    seen.add(item.url)
    media.push(item)
  }

  if (post.is_video && post.media?.reddit_video?.fallback_url) {
    pushMedia({
      type: "video",
      url: String(post.media.reddit_video.fallback_url),
      thumbnail: decodeHtml(post.thumbnail),
    })
  } else if (post.gallery_data?.items?.length && post.media_metadata) {
    for (const item of post.gallery_data.items as Array<{ media_id?: string }>) {
      const mediaId = item?.media_id
      const metadata = mediaId ? post.media_metadata[mediaId] : null
      const imageUrl =
        decodeHtml(metadata?.s?.u) ||
        decodeHtml(metadata?.s?.gif) ||
        decodeHtml(metadata?.p?.at(-1)?.u)

      if (!imageUrl) continue

      pushMedia({
        type: "image",
        url: imageUrl,
        thumbnail: imageUrl,
      })
    }
  }

  if (!media.length && post.preview?.images?.length) {
    for (const img of post.preview.images) {
      const src = img?.source?.url
      if (!src) continue
      const imageUrl = decodeHtml(src)
      if (!imageUrl) continue
      pushMedia({ type: "image", url: imageUrl, thumbnail: imageUrl })
    }
  }

  if (!media.length && post.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url)) {
    pushMedia({
      type: "image",
      url: String(post.url),
      thumbnail: String(post.url),
    })
  }

  return media
}

async function resolveRedditFromOldReddit(url: string): Promise<ResolveResult | null> {
  const u = new URL(url)
  const oldRedditUrl = `https://old.reddit.com${u.pathname}`
  const res = await fetch(oldRedditUrl, {
    headers: { "User-Agent": REDDIT_USER_AGENT },
    cache: "no-store",
  })
  if (!res.ok) return null

  const html = await res.text()
  const title = extractMeta(html, "og:title") ?? "Reddit post"
  const thumbnail = extractMeta(html, "og:image")
  const authorMatch = html.match(/Posted in .* by u\/([^ <]+)/i)
  const hlsUrl = extractHtmlAttr(html, "data-hls-url")
  const mpdUrl = extractHtmlAttr(html, "data-mpd-url")
  const directVideoUrl = mpdUrl ? await extractRedditDashVideo(mpdUrl) : null
  const oldRedditMedia = extractOldRedditMedia(html)

  const media: MediaItem[] = []
  if (directVideoUrl) {
    media.push({ type: "video", url: directVideoUrl, thumbnail })
  } else if (hlsUrl) {
    media.push({ type: "video", url: hlsUrl, thumbnail })
  } else if (oldRedditMedia.length) {
    media.push(...oldRedditMedia)
  } else if (thumbnail) {
    media.push({ type: "image", url: thumbnail, thumbnail })
  }

  if (!media.length) return null

  return {
    platform: "reddit",
    title,
    author: authorMatch?.[1] ? `u/${authorMatch[1]}` : undefined,
    media,
  }
}

function extractHtmlAttr(html: string, attr: string): string | undefined {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = html.match(new RegExp(`${escaped}="([^"]+)"`, "i"))
  return decodeHtml(match?.[1])
}

function extractOldRedditMedia(html: string): MediaItem[] {
  const postBlock = html.match(/<div class=" thing id-t3_[\s\S]*?<div class='commentarea'>/i)?.[0] ?? html
  const galleryMatches = [
    ...postBlock.matchAll(
      /<a class="may-blank gallery-item-thumbnail-link"[^>]*data-position="(\d+)"[^>]*href="([^"]+)"/gi,
    ),
  ]

  if (galleryMatches.length) {
    return galleryMatches
      .map((match) => ({
        position: Number(match[1]),
        url: decodeHtml(match[2]),
      }))
      .filter((item): item is { position: number; url: string } => Boolean(item.url))
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        type: "image" as const,
        url: item.url,
        thumbnail: item.url,
      }))
  }

  const singleImageUrl = decodeHtml(
    postBlock.match(/<div class="media-preview-content">[\s\S]*?<a[^>]+href="([^"]+)"/i)?.[1],
  )
  if (singleImageUrl) {
    return [{ type: "image", url: singleImageUrl, thumbnail: singleImageUrl }]
  }

  return []
}

async function extractRedditDashVideo(mpdUrl: string): Promise<string | null> {
  try {
    const res = await fetch(mpdUrl, {
      headers: { "User-Agent": REDDIT_USER_AGENT },
      cache: "no-store",
    })
    if (!res.ok) return null

    const mpd = await res.text()
    const matches = [...mpd.matchAll(/<Representation[^>]+mimeType="video\/mp4"[\s\S]*?<BaseURL>([^<]+)<\/BaseURL>/g)]
    const bestVideo = matches.at(-1)?.[1]
    return bestVideo ? new URL(bestVideo, mpdUrl).href : null
  } catch {
    return null
  }
}

// #region debug-point A:tiktok-debug-report-helper
function reportDebugTikTok(hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) {
  return fetch("http://127.0.0.1:7777/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: TIKTOK_DEBUG_SESSION,
      runId: "pre-fix",
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {})
}
// #endregion

function decodeHtml(input?: string): string | undefined {
  if (!input) return undefined
  return input.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
}

function matchDecoded(html: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return decodeHtml(
        match[1]
          .replace(/\\u002F/g, "/")
          .replace(/\\u0026/g, "&")
          .replace(/\\\\\//g, "/")
          .replace(/\\\//g, "/"),
      )
    }
  }
}

function extractMeta(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return matchDecoded(html, [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ])
}

function extractInstagramVideo(html: string): string | undefined {
  return matchDecoded(html, [
    /<meta property="og:video" content="([^"]+)"/i,
    /<meta property="og:video:secure_url" content="([^"]+)"/i,
    /"video_url":"([^"]+)"/i,
    /\\"video_url\\":\\"([^"]+)\\"/i,
    /"contentUrl":"([^"]+)"/i,
    /\\"contentUrl\\":\\"([^"]+)\\"/i,
    /"video_versions":\[\{[^}]*"url":"([^"]+)"/i,
    /\\"video_versions\\":\[\{[^}]*\\"url\\":\\"([^"]+)\\"/i,
  ])
}

function normalizeEscapedPayload(input: string): string {
  return input
    .replace(/\\u002F/g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/\\\\\//g, "/")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
}

function extractInstagramMedia(html: string): MediaItem[] {
  const normalized = normalizeEscapedPayload(html)
  const media: MediaItem[] = []
  const seen = new Set<string>()

  for (const match of normalized.matchAll(/"node":\{"__typename":"GraphImage"[\s\S]*?"display_url":"([^"]+)"/g)) {
    const imageUrl = decodeHtml(match[1])
    if (!imageUrl || seen.has(imageUrl)) continue

    seen.add(imageUrl)
    media.push({ type: "image", url: imageUrl, thumbnail: imageUrl })
  }

  for (const match of normalized.matchAll(
    /"node":\{"__typename":"GraphVideo"[\s\S]*?"display_url":"([^"]+)"[\s\S]*?"video_url":"([^"]+)"/g,
  )) {
    const thumbnail = decodeHtml(match[1])
    const videoUrl = decodeHtml(match[2])
    if (!videoUrl || seen.has(videoUrl)) continue

    seen.add(videoUrl)
    media.push({
      type: "video",
      url: videoUrl,
      thumbnail,
    })
  }

  return media
}

function getInstagramEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname.replace(/\/$/, "")
    return `${parsed.origin}${pathname}/embed/`
  } catch {
    return null
  }
}

function extractTikTokVideo(html: string): string | undefined {
  return matchDecoded(html, [
    /<meta property="og:video" content="([^"]+)"/i,
    /<meta property="og:video:secure_url" content="([^"]+)"/i,
    /"downloadAddr":"([^"]+)"/i,
    /\\"downloadAddr\\":\\"([^"]+)\\"/i,
    /"playAddr":"([^"]+)"/i,
    /\\"playAddr\\":\\"([^"]+)\\"/i,
    /"playUrl":"([^"]+)"/i,
    /\\"playUrl\\":\\"([^"]+)\\"/i,
    /"video":\{"urls":\["([^"]+)"/i,
    /\\"video\\":\{\\"urls\\":\[\\"([^"]+)\\"/i,
    /"src":"([^"]+\.mp4[^"]*)"/i,
    /\\"src\\":\\"([^"]+\.mp4[^"]*)\\"/i,
  ])
}

function extractTikTokImage(html: string): string | undefined {
  return matchDecoded(html, [
    /<meta property="og:image" content="([^"]+)"/i,
    /<meta property="og:image:secure_url" content="([^"]+)"/i,
    /"poster":"([^"]+)"/i,
    /\\"poster\\":\\"([^"]+)\\"/i,
    /"thumbnail_url":"([^"]+)"/i,
    /\\"thumbnail_url\\":\\"([^"]+)\\"/i,
    /"coversOrigin":\["([^"]+)"/i,
    /\\"coversOrigin\\":\[\\"([^"]+)\\"/i,
    /"covers":\["([^"]+)"/i,
    /\\"covers\\":\[\\"([^"]+)\\"/i,
    /"coversDynamic":\["([^"]+)"/i,
    /\\"coversDynamic\\":\[\\"([^"]+)\\"/i,
  ])
}

function extractTikTokVideoId(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname
    return pathname.match(/\/video\/(\d+)/i)?.[1]
  } catch {
    return undefined
  }
}

async function resolveTikTokFromEmbed(videoId: string): Promise<{
  videoUrl?: string
  imageUrl?: string
  title?: string
} | null> {
  try {
    const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`
    const embedRes = await fetch(embedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      cache: "no-store",
      redirect: "follow",
    })
    void reportDebugTikTok("D", "app/api/resolve/route.ts:255", "TikTok embed fetch response", {
      ok: embedRes.ok,
      status: embedRes.status,
      finalUrl: embedRes.url,
      contentType: embedRes.headers.get("content-type"),
      videoId,
    })
    if (!embedRes.ok) return null

    const embedHtml = await embedRes.text()
    const videoUrl = extractTikTokVideo(embedHtml)
    const imageUrl = extractTikTokImage(embedHtml)
    const title = extractMeta(embedHtml, "og:title") ?? extractMeta(embedHtml, "og:description")

    void reportDebugTikTok("D", "app/api/resolve/route.ts:271", "TikTok embed extraction result", {
      videoUrl: videoUrl ?? null,
      imageUrl: imageUrl ?? null,
      title: title ?? null,
      selectedType: videoUrl ? "video" : imageUrl ? "image" : "none",
    })

    if (!videoUrl && !imageUrl && !title) return null

    return { videoUrl, imageUrl, title }
  } catch {
    return null
  }
}

async function resolveInstagram(url: string): Promise<ResolveResult | null> {
  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`
  let oembed: any = null

  try {
    const res = await fetch(`https://www.instagram.com/oembed/?url=${encodeURIComponent(withProtocol)}`, { cache: "no-store" })
    if (res.ok) oembed = await res.json()
  } catch {}

  try {
    const pageRes = await fetch(withProtocol, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      cache: "no-store",
    })
    if (!pageRes.ok) return null

    const html = await pageRes.text()
    let media = extractInstagramMedia(html)
    let videoUrl = extractInstagramVideo(html)
    let imageUrl = media[0]?.thumbnail ?? extractMeta(html, "og:image") ?? oembed?.thumbnail_url

    if (media.length <= 1 || !media.some((item) => item.type === "video")) {
      const embedUrl = getInstagramEmbedUrl(withProtocol)
      const embedRes = embedUrl
        ? await fetch(embedUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
            cache: "no-store",
          })
        : null
      if (embedRes.ok) {
        const embedHtml = await embedRes.text()
        const embedMedia = extractInstagramMedia(embedHtml)
        const embedVideoUrl = extractInstagramVideo(embedHtml)
        const embedImageUrl =
          extractMeta(embedHtml, "og:image") ??
          matchDecoded(embedHtml, [
            /"thumbnail_src":"([^"]+)"/i,
            /\\"thumbnail_src\\":\\"([^"]+)\\"/i,
            /"display_url":"([^"]+)"/i,
            /\\"display_url\\":\\"([^"]+)\\"/i,
          ])
        if (embedMedia.length > media.length) {
          media = embedMedia
        }
        videoUrl = embedVideoUrl ?? videoUrl
        imageUrl = embedImageUrl ?? imageUrl
      }
    }

    if (!media.length && (videoUrl || imageUrl)) {
      media = [{ type: videoUrl ? "video" : "image", url: videoUrl ?? imageUrl, thumbnail: imageUrl }]
    }

    if (!media.length) return null

    return {
      platform: "instagram",
      title: extractMeta(html, "og:title") ?? oembed?.title ?? "Instagram post",
      author: oembed?.author_name,
      media,
    }
  } catch {
    return null
  }
}

async function resolveTikTok(url: string): Promise<ResolveResult | null> {
  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`
  let oembed: any = null

  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(withProtocol)}`, { cache: "no-store" })
    if (res.ok) oembed = await res.json()
    // #region debug-point C:tiktok-oembed
    void reportDebugTikTok("C", "app/api/resolve/route.ts:303", "TikTok oEmbed response", {
      ok: res.ok,
      status: res.status,
      hasThumbnail: Boolean(oembed?.thumbnail_url),
      title: oembed?.title ?? null,
      author: oembed?.author_name ?? null,
    })
    // #endregion
  } catch {}

  try {
    const pageRes = await fetch(withProtocol, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      cache: "no-store",
      redirect: "follow",
    })
    // #region debug-point C:tiktok-page-response
    void reportDebugTikTok("C", "app/api/resolve/route.ts:318", "TikTok page fetch response", {
      ok: pageRes.ok,
      status: pageRes.status,
      finalUrl: pageRes.url,
      contentType: pageRes.headers.get("content-type"),
    })
    // #endregion
    if (!pageRes.ok) return null

    const html = await pageRes.text()
    let videoUrl = extractTikTokVideo(html)
    let imageUrl = extractTikTokImage(html)
    let title = extractMeta(html, "og:title") ?? extractMeta(html, "og:description")

    if (!videoUrl) {
      const videoId = extractTikTokVideoId(pageRes.url) ?? extractTikTokVideoId(withProtocol)
      if (videoId) {
        const embedResult = await resolveTikTokFromEmbed(videoId)
        videoUrl = embedResult?.videoUrl ?? videoUrl
        imageUrl = embedResult?.imageUrl ?? imageUrl
        title = embedResult?.title ?? title
      }
    }

    imageUrl = imageUrl ?? oembed?.thumbnail_url
    // #region debug-point A:tiktok-html-signals
    void reportDebugTikTok("A", "app/api/resolve/route.ts:329", "TikTok HTML extraction signals", {
      hasOgVideo: html.includes('property="og:video"') || html.includes("property='og:video'"),
      hasOgVideoSecure: html.includes('property="og:video:secure_url"') || html.includes("property='og:video:secure_url'"),
      hasDownloadAddr: html.includes('"downloadAddr"') || html.includes('\\"downloadAddr\\"'),
      hasPlayAddr: html.includes('"playAddr"') || html.includes('\\"playAddr\\"'),
      hasPlayUrl: html.includes('"playUrl"') || html.includes('\\"playUrl\\"'),
      hasImageMeta: html.includes('property="og:image"') || html.includes("property='og:image'"),
      hasMp4: html.includes(".mp4"),
      htmlSnippet: html.slice(0, 240),
    })
    // #endregion
    // #region debug-point B:tiktok-extraction-result
    void reportDebugTikTok("B", "app/api/resolve/route.ts:341", "TikTok extraction result", {
      videoUrl: videoUrl ?? null,
      imageUrl: imageUrl ?? null,
      selectedType: videoUrl ? "video" : imageUrl ? "image" : "none",
    })
    // #endregion
    if (!videoUrl && !imageUrl) return null

    return {
      platform: "tiktok",
      title: title?.trim() || oembed?.title?.trim() || "TikTok video",
      author: oembed?.author_name,
      media: [{ type: videoUrl ? "video" : "image", url: videoUrl ?? imageUrl, thumbnail: imageUrl }],
    }
  } catch {
    return null
  }
}
