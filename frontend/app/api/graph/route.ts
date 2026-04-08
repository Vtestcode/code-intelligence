import { NextRequest } from 'next/server'
import { proxyJson } from '@/app/api/_lib/proxy'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString()
  return proxyJson(request, query ? `/graph?${query}` : '/graph')
}
