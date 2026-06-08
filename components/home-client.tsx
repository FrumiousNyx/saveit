"use client"

import { useState } from "react"
import { Moon, Sun } from "lucide-react"
import { PlatformIcon } from "@/components/platform-icons"
import { Downloader } from "@/components/downloader"

export function HomeClient() {
  const [dark, setDark] = useState(false)

  function toggle() {
    setDark((d) => {
      const next = !d
      document.documentElement.classList.toggle("dark", next)
      return next
    })
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
              <path
                d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-mono text-sm font-medium tracking-tight">AnyDownloader</span>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle color theme"
          className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      <section className="flex flex-1 flex-col justify-center pb-16 pt-8 sm:pt-4">
        <div className="mb-8 flex flex-col items-start gap-4">
          <span className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
            no ads · no signup
          </span>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Download media from anywhere.
          </h1>
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
            Paste one Instagram, Reddit, or TikTok link to download videos or
            images fast, with ordered batch image support for Instagram and
            Reddit gallery posts.
          </p>
        </div>

        <Downloader />

        <div className="mt-10 flex items-center gap-6">
          {(["instagram", "reddit", "tiktok"] as const).map((p) => (
            <div key={p} className="flex items-center gap-2 text-muted-foreground">
              <PlatformIcon platform={p} className="size-5" />
              <span className="text-sm capitalize">{p}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-6 text-xs text-muted-foreground">
        <p className="text-pretty leading-relaxed">
          Only download content you own or have permission to use. Respect each
          platform&apos;s terms of service and applicable copyright laws.
        </p>
      </footer>
    </main>
  )
}
