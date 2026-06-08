import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url")
  const requestedFilename = searchParams.get("filename")

  if (!url) {
    return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch media" }, { status: response.status })
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream"
    const contentLength = response.headers.get("content-length")

    const extension = getExtension(url, contentType)
    const fallbackName = getNameFromUrl(url) || "download"
    const baseName = sanitizeFilename(requestedFilename || fallbackName)
    const filename = ensureExtension(baseName, extension)

    // Stream the response
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": contentLength || buffer.length.toString(),
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json({ error: "Failed to download media" }, { status: 500 })
  }
}

function getExtension(url: string, contentType: string) {
  if (contentType.includes("mp4")) return ".mp4"
  if (contentType.includes("webm")) return ".webm"
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg"
  if (contentType.includes("png")) return ".png"
  if (contentType.includes("gif")) return ".gif"
  if (contentType.includes("webp")) return ".webp"

  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/(\.[a-z0-9]{2,5})$/i)
    return match?.[1]?.toLowerCase() || ""
  } catch {
    return ""
  }
}

function getNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname
    const lastSegment = pathname.split("/").filter(Boolean).at(-1)
    if (!lastSegment) return undefined
    return lastSegment.replace(/\.[a-z0-9]{2,5}$/i, "")
  } catch {
    return undefined
  }
}

function sanitizeFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

  return cleaned || "download"
}

function ensureExtension(filename: string, extension: string) {
  if (!extension) return filename
  return filename.toLowerCase().endsWith(extension.toLowerCase()) ? filename : `${filename}${extension}`
}
