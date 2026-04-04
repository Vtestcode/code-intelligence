import { NextRequest } from 'next/server'
import { proxyJson } from '@/app/api/_lib/proxy'

export async function POST(request: NextRequest) {
  return proxyJson(request, '/ingest')
}
