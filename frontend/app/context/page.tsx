'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import type { AnswerResponse, RetrievedItem } from '@/lib/types'

const STORAGE_KEY = 'code-intel-last-answer'

type StoredPayload = {
  data: AnswerResponse
  session?: {
    name?: string
    namespace?: string
  } | null
  question?: string
}

export default function ContextPage() {
  const [payload, setPayload] = useState<StoredPayload | null>(null)

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      setPayload(JSON.parse(raw) as StoredPayload)
    } catch {
      setPayload(null)
    }
  }, [])

  const items = useMemo<RetrievedItem[]>(() => {
    if (!payload) return []
    return [...payload.data.cypher_context, ...payload.data.vector_context]
  }, [payload])

  return (
    <main className="min-h-screen px-4 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-7xl rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,42,0.95),rgba(10,13,24,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/75">Retrieved Context</p>
            <h1 className="mt-3 font-[var(--font-display)] text-[3rem] font-bold leading-none tracking-[-0.04em] text-white">
              Evidence View
            </h1>
            <p className="mt-4 max-w-3xl text-white/65">
              {payload?.question ? `Latest question: ${payload.question}` : 'Run a query from the home screen to populate evidence.'}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Back Home
          </Link>
        </div>

        <div className="mt-6 grid gap-4">
          {items.length === 0 ? (
            <div className="rounded-[1.8rem] border border-white/8 bg-white/[0.02] p-6 text-lg text-white/72">
              No retrieved evidence is available yet. Ask a question from the home screen first.
            </div>
          ) : (
            items.map((item, index) => (
              <div key={`${item.repo}-${item.path}-${index}`} className="rounded-[1.8rem] border border-white/8 bg-white/[0.02] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-cyan-200">{item.repo}</p>
                    <p className="mt-1 text-sm text-white/50">
                      {item.path}
                      {item.symbol ? ` | ${item.symbol}` : ''}
                    </p>
                  </div>
                  <div className="text-sm uppercase tracking-[0.16em] text-white/50">
                    {item.kind} | {item.score.toFixed(3)}
                  </div>
                </div>
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-[1.25rem] border border-white/6 bg-[#0b101c]/70 p-4 text-sm leading-relaxed text-white/80">
                  {item.content}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
