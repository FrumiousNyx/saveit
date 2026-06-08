"use client"

import { useMemo, useState } from "react"
import { ArrowDown, Download, Link2, Loader2, X } from "lucide-react"
import { detectPlatform, isValidUrl, PLATFORM_LABELS, type Platform } from "@/lib/platforms"
import { PlatformIcon } from "@/components/platform-icons"
import { cn } from "@/lib/utils"

type MediaItem = {
  type: "video" | "image"
  url: string
  thumbnail?: string
}

type ResolveResult = {
  platform: string
  title: string
  author?: string
  media: MediaItem[]
}

type Status = "idle" | "loading" | "success" | "error"

export function Downloader() {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [result, setResult] = useState<ResolveResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const detected = useMemo<Platform | null>(() => detectPlatform(url), [url])
  const valid = useMemo(() => isValidUrl(url), [url])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setStatus("loading")
    setResult(null)
    setMessage(null)

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setMessage(data?.error ?? "Something went wrong. Please try again.")
        return
      }

      setResult(data as ResolveResult)
      setStatus("success")
    } catch {
      setStatus("error")
      setMessage("Network error. Please check your connection and try again.")
    }
  }

  function reset() {
    setUrl("")
    setStatus("idle")
    setResult(null)
    setMessage(null)
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text.trim())
    } catch {
      // clipboard permission denied — ignore silently
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div
          className={cn(
            "group flex items-center gap-2 rounded-2xl border bg-card px-3 py-2 transition-colors",
            "focus-within:border-foreground/40",
            status === "error" ? "border-destructive/50" : "border-border",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center text-muted-foreground">
            {detected ? (
              <PlatformIcon platform={detected} className="size-5 text-foreground" />
            ) : (
              <Link2 className="size-5" />
            )}
          </span>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (status !== "idle") setStatus("idle")
            }}
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Paste a link…"
            aria-label="Media link"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
          {url ? (
            <button
              type="button"
              onClick={reset}
              aria-label="Clear input"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={paste}
              className="shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              paste
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!valid || status === "loading"}
          className={cn(
            "flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-medium text-primary-foreground transition-all",
            "disabled:cursor-not-allowed disabled:opacity-40",
            "active:scale-[0.99]",
          )}
        >
          {status === "loading" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Fetching…
            </>
          ) : (
            <>
              <ArrowDown className="size-4" />
              Get media
            </>
          )}
        </button>
      </form>

      {/* Hint / detected platform */}
      {url && status === "idle" && (
        <p className="px-1 text-xs text-muted-foreground">
          {detected
            ? `${PLATFORM_LABELS[detected]} link detected.`
            : valid
              ? "Unsupported site — use an Instagram, Reddit, or TikTok link."
              : "Enter a full link including the domain."}
        </p>
      )}

      {status === "error" && message && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {message}
        </div>
      )}

      {status === "success" && result && <ResultCard result={result} />}
    </div>
  )
}

function ResultCard({ result }: { result: ResolveResult }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <PlatformIcon
          platform={result.platform as Platform}
          className="size-5 text-foreground"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{result.title}</p>
          {result.author && (
            <p className="truncate text-xs text-muted-foreground">{result.author}</p>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border">
        {result.media.map((item, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
              {item.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail || "/placeholder.svg"}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  {item.type}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium capitalize">{item.type}</p>
              <p className="truncate text-xs text-muted-foreground">{item.url}</p>
            </div>
            <a
              href={`/api/download?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(buildDownloadName(result, item, i))}`}
              target="_blank"
              rel="noreferrer"
              download
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              aria-label={`Download ${item.type}`}
            >
              <Download className="size-4" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function buildDownloadName(result: ResolveResult, item: MediaItem, index: number) {
  const title = result.title.trim()
  const suffix = result.media.length > 1 ? `-${index + 1}` : ""
  const fallback = `${result.platform}-${item.type}${suffix}`
  return title ? `${title}${suffix}` : fallback
}
