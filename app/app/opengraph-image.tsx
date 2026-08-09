import { ImageResponse } from 'next/og'

export const alt = 'ClearNote — verified finance on Monad'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: '#fffef7',
          border: '8px solid #000',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ffdb33',
              border: '4px solid #000',
              fontSize: 48,
              fontWeight: 900,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.02em' }}>ClearNote</div>
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.25, maxWidth: 900 }}>
          Verified trade finance on Monad — compliance pre-flight, obligor acceptance, DvP settlement.
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#444' }}>Monad testnet · chain 10143</div>
      </div>
    ),
    { ...size },
  )
}
