import { NextRequest, NextResponse } from 'next/server'
import { setSessionCookie } from '@/app/api/_lib/proxy'
import type { AuthTokenResponse } from '@/lib/types'

type BackendAuthTokenResponse = AuthTokenResponse & { access_token: string }

export async function POST(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8000'
  const body = await request.text()
  const response = await fetch(`${backendUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  })

  const payload = (await response.json()) as BackendAuthTokenResponse | { detail?: string }
  if (!response.ok || !('access_token' in payload)) {
    return NextResponse.json(payload, { status: response.status })
  }

  const nextResponse = NextResponse.json(
    {
      token_type: payload.token_type,
      expires_in: payload.expires_in,
      user: payload.user,
    },
    { status: response.status },
  )
  setSessionCookie(nextResponse, payload.access_token, payload.expires_in)
  return nextResponse
}
