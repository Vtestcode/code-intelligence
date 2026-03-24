import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8000'
  const response = await fetch(`${backendUrl}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

function tryParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
