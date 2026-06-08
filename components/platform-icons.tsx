import type { Platform } from "@/lib/platforms"

function InstagramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  )
}

function RedditMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="13" r="8.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="13" r="1.1" fill="currentColor" />
      <circle cx="15" cy="13" r="1.1" fill="currentColor" />
      <path d="M9 16c.9.7 1.9 1 3 1s2.1-.3 3-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="19.5" cy="9" r="1.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 4.6 15.4 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function TiktokMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M14 4c.4 2.3 1.9 3.9 4 4.3v2.6c-1.5 0-2.9-.4-4-1.2v5.6c0 2.9-2.3 5.1-5.1 5.1S3.8 18.2 3.8 15.3c0-2.7 2-4.9 4.7-5.1v2.7a2.4 2.4 0 1 0 1.8 2.3V4H14Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const MARKS: Record<Platform, (props: { className?: string }) => React.ReactElement> = {
  instagram: InstagramMark,
  reddit: RedditMark,
  tiktok: TiktokMark,
}

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const Mark = MARKS[platform]
  return <Mark className={className} />
}
