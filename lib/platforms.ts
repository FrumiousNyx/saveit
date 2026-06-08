export type Platform = "instagram" | "reddit" | "tiktok"

export type DetectedPlatform = Platform | null

const PATTERNS: Record<Platform, RegExp[]> = {
  instagram: [/(?:^|\.)instagram\.com/i, /(?:^|\.)instagr\.am/i, /(?:^|\.)ig\.me/i],
  reddit: [/(?:^|\.)reddit\.com/i, /(?:^|\.)redd\.it/i],
  tiktok: [/(?:^|\.)tiktok\.com/i, /(?:^|\.)vm\.tiktok\.com/i],
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  reddit: "Reddit",
  tiktok: "TikTok",
}

export function detectPlatform(rawUrl: string): DetectedPlatform {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  let host = ""
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    host = new URL(withProtocol).hostname
  } catch {
    host = trimmed
  }

  for (const platform of Object.keys(PATTERNS) as Platform[]) {
    if (PATTERNS[platform].some((re) => re.test(host))) {
      return platform
    }
  }
  return null
}

export function isValidUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim()
  if (!trimmed) return false
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const u = new URL(withProtocol)
    return Boolean(u.hostname.includes("."))
  } catch {
    return false
  }
}
