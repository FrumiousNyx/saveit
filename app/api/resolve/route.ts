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

function extractTikTokMedia(html: string): MediaItem[] {
  const normalized = normalizeEscapedPayload(html)
  const media: MediaItem[] = []
  const seen = new Set<string>()

  const pushImage = (url?: string, thumbnail?: string) => {
    const imageUrl = decodeHtml(url)
    if (!imageUrl || seen.has(imageUrl)) return
    seen.add(imageUrl)
    media.push({
      type: "image",
      url: imageUrl,
      thumbnail: decodeHtml(thumbnail) ?? imageUrl,
    })
  }

  const imagePatterns = [
    /"imagePost":\{"images":\[(.*?)\]/gi,
    /"imagePostInfo":\{"images":\[(.*?)\]/gi,
    /"images":\[(\{"imageURL":[\s\S]*?\})\]/gi,
    /"imageList":\[(.*?)\]/gi,
  ]

  for (const pattern of imagePatterns) {
    for (const blockMatch of normalized.matchAll(pattern)) {
      const block = blockMatch[1]
      if (!block) continue

      for (const imageMatch of block.matchAll(
        /"(?:imageURL|imageUrl|displayImage|image)":\{"(?:urlList|url_list|urls)":\["([^"]+)"/gi,
      )) {
        pushImage(imageMatch[1])
      }

      for (const imageMatch of block.matchAll(
        /"(?:imageURL|imageUrl|displayImage|image)":\{"url":"([^"]+)"/gi,
      )) {
        pushImage(imageMatch[1])
      }
    }
  }

  if (!media.length) {
    for (const match of normalized.matchAll(
      /"(?:imageURL|imageUrl|displayImage|image)":\{"(?:urlList|url_list|urls)":\["([^"]+)"/gi,
    )) {
      pushImage(match[1])
    }
  }

  if (!media.length) {
    for (const match of normalized.matchAll(/"(?:photo|image)(?:Url|URL)?":"(https:[^"]+)"/gi)) {
      pushImage(match[1])
    }
  }

  if (!media.length) {
    for (const match of normalized.matchAll(
      /https?:\/\/p\d+\.muscdn\.com\/img\/musically-[^"' <]+~noop\.(?:webp|png|jpe?g)/gi,
    )) {
      pushImage(match[0])
    }
  }

  return media
}

function extractTikTokPostId(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname
    return pathname.match(/\/(?:video|photo)\/(\d+)/i)?.[1]
  } catch {
    return undefined
  }
}

function extractTikTokHandle(url: string): string | undefined {
  try {
    return new URL(url).pathname.match(/^\/@([^/]+)/)?.[1]
  } catch {
    return undefined
  }
}

async function resolveTikTokFromEmbed(videoId: string): Promise<{
  media: MediaItem[]
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
    if (!embedRes.ok) return null

    const embedHtml = await embedRes.text()
    const media = extractTikTokMedia(embedHtml)
    const videoUrl = extractTikTokVideo(embedHtml)
    const imageUrl = media[0]?.thumbnail ?? extractTikTokImage(embedHtml)
    const title = extractMeta(embedHtml, "og:title") ?? extractMeta(embedHtml, "og:description")

    if (!media.length && !videoUrl && !imageUrl && !title) return null

    return { media, videoUrl, imageUrl, title }
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
  } catch {}

  try {
    const pageRes = await fetch(withProtocol, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      cache: "no-store",
      redirect: "follow",
    })
    if (!pageRes.ok) return null

    const html = await pageRes.text()
    let media = extractTikTokMedia(html)
    let videoUrl = extractTikTokVideo(html)
    let imageUrl = media[0]?.thumbnail ?? extractTikTokImage(html)
    let title = extractMeta(html, "og:title") ?? extractMeta(html, "og:description")

    const videoId = extractTikTokPostId(pageRes.url) ?? extractTikTokPostId(withProtocol)
    if ((!videoUrl && !media.length) || /\/photo\//i.test(pageRes.url) || /\/photo\//i.test(withProtocol)) {
      if (videoId) {
        const embedResult = await resolveTikTokFromEmbed(videoId)
        if ((embedResult?.media?.length ?? 0) > media.length) {
          media = embedResult?.media ?? media
        }
        videoUrl = embedResult?.videoUrl ?? videoUrl
        imageUrl = embedResult?.imageUrl ?? imageUrl
        title = embedResult?.title ?? title
      }
    }

    imageUrl = imageUrl ?? oembed?.thumbnail_url
    if (!media.length && !videoUrl && !imageUrl) return null

    if (!media.length && (videoUrl || imageUrl)) {
      media = [{ type: videoUrl ? "video" : "image", url: videoUrl ?? imageUrl, thumbnail: imageUrl }]
    }

    return {
      platform: "tiktok",
      title:
        title?.trim() ||
        oembed?.title?.trim() ||
        (media.length > 1 ? "TikTok photo post" : videoUrl ? "TikTok video" : "TikTok image"),
      author: oembed?.author_name || extractTikTokHandle(pageRes.url) || extractTikTokHandle(withProtocol),
      media,
    }
  } catch {
    return null
  }
}
