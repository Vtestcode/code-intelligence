import { NextRequest, NextResponse } from 'next/server'

export const AUTH_COOKIE_NAME = 'code_intel_session'

export async function proxyJson(request: NextRequest, path: string) {
  const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8000'
  const authHeader = request.headers.get('authorization')
  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const contentType = request.headers.get('content-type') || 'application/json'
  const initHeaders: Record<string, string> = {
    'Content-Type': contentType,
  }

  if (authHeader) {
    initHeaders.Authorization = authHeader
  } else if (cookieToken) {
    initHeaders.Authorization = `Bearer ${cookieToken}`
  }

  const method = request.method || 'GET'
  const body = method === 'GET' ? undefined : await request.text()
  const response = await fetch(`${backendUrl}${path}`, {
    method,
    headers: initHeaders,
    body,
    cache: 'no-store',
  })

  const raw = await response.text()
  const data = raw ? tryParseJson(raw) : null

  if (data) {
    return NextResponse.json(data, { status: response.status })
  }

  return NextResponse.json(
    {
      detail:
        raw ||
        `Backend returned ${response.status} ${response.statusText || 'with an empty response body'}. Check the backend logs for the underlying error.`,
    },
    { status: response.status || 502 },
  )
}

export function setSessionCookie(response: NextResponse, token: string, maxAgeSeconds: number) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
