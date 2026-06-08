import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch media preview" }, { status: response.status })
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream"
    const contentLength = response.headers.get("content-length")
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": contentLength || buffer.length.toString(),
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    })
  } catch (error) {
    console.error("Media proxy error:", error)
    return NextResponse.json({ error: "Failed to load media preview" }, { status: 500 })
  }
}
