import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
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
            'linear-gradient(135deg, #09090b 0%, #111827 40%, #1d4ed8 100%)',
          color: '#ffffff',
          padding: '56px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: 28,
            opacity: 0.95,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 56,
              height: 56,
              borderRadius: 18,
              background: 'rgba(255,255,255,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ display: 'flex' }}>AnyDownloader</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              maxWidth: 900,
            }}
          >
            Download Instagram, Reddit, and TikTok media
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              lineHeight: 1.35,
              color: 'rgba(255,255,255,0.78)',
              maxWidth: 860,
            }}
          >
            Paste a link, preview the media, and save it with clean filenames.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '14px',
            fontSize: 24,
          }}
        >
          {['Instagram', 'Reddit', 'TikTok'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                padding: '12px 20px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.16)',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  )
}
