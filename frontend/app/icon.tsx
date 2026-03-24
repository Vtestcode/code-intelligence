import { ImageResponse } from 'next/og'

export const size = {
  width: 64,
  height: 64,
}

export const contentType = 'image/png'

export default function Icon(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #1d2438 0%, #171d31 100%)',
          borderRadius: 18,
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <svg viewBox="0 0 64 64" width="30" height="30" fill="none">
            <path d="M10 16 26 8v34L10 50Z" stroke="white" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M26 8 42 16v34L26 42Z" stroke="white" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M42 16 54 22v34L42 50Z" stroke="rgba(255,255,255,0.72)" strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    ),
    size,
  )
}
