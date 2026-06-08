import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'radial-gradient(circle at top left, #2563eb 0%, #111827 40%, #09090b 100%)',
          color: '#ffffff',
          padding: '56px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: 28,
            opacity: 0.95,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ display: 'flex' }}>Saveit</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              maxWidth: 900,
            }}
          >
            Fast social media downloads, ready to share
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              lineHeight: 1.35,
              color: 'rgba(255,255,255,0.78)',
              maxWidth: 840,
            }}
          >
            Instagram, Reddit, and TikTok support with cleaner download names.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 24,
            color: 'rgba(255,255,255,0.82)',
          }}
        >
          saveit app
        </div>
      </div>
    ),
    size,
  )
}
