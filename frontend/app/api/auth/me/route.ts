import { NextRequest } from 'next/server'
import { proxyJson } from '@/app/api/_lib/proxy'

export async function GET(request: NextRequest) {
  return proxyJson(request, '/auth/me')
}
