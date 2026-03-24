'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import GraphPanel from '@/components/GraphPanel'
import type { AnswerResponse } from '@/lib/types'

const STORAGE_KEY = 'code-intel-last-answer'

type StoredPayload = {
  data: AnswerResponse
  session?: {
    name?: string
    namespace?: string
  } | null
  question?: string
}

export default function GraphPage() {
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

  return (
    <main className="min-h-screen px-4 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-[1500px] rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,42,0.95),rgba(10,13,24,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/75">Knowledge Graph</p>
            <h1 className="mt-3 font-[var(--font-display)] text-[3rem] font-bold leading-none tracking-[-0.04em] text-white">
              Full Graph View
            </h1>
            <p className="mt-4 max-w-3xl text-white/65">
              {payload?.question ? `Latest question: ${payload.question}` : 'Run a query from the home screen to populate the graph.'}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Back Home
          </Link>
        </div>

        <div className="mt-6 rounded-[1.8rem] border border-white/8 bg-white/[0.02] p-5">
          <div className="mb-4 flex flex-wrap gap-6 text-sm text-white/58">
            <span>Repo: {payload?.session?.name || 'None selected'}</span>
            <span>Namespace: {payload?.session?.namespace || 'N/A'}</span>
            <span>
              Nodes: {payload?.data.graph.stats.nodes ?? 0} | Edges: {payload?.data.graph.stats.relationships ?? 0}
            </span>
          </div>
          <GraphPanel graph={payload?.data.graph || { nodes: [], links: [] }} heightClass="h-[620px] xl:h-[720px]" />
        </div>
      </div>
    </main>
  )
}
