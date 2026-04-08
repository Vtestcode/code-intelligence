'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import GraphPanel from '@/components/GraphPanel'
import type { GraphData } from '@/lib/types'

type StoredWorkspace = {
  sessions?: Array<{
    id: string
    name: string
    namespace: string
    repoUrl: string
    filesIndexed: number
  }>
  selectedSessionId?: string
  data?: { graph?: GraphData } | null
  graphStats?: GraphData['stats']
}

const WORKSPACE_STORAGE_KEY = 'code-intel-workspace'
const emptyGraph: GraphData = {
  nodes: [],
  links: [],
  stats: { nodes: 0, relationships: 0 },
}

export default function GraphPage() {
  const [graph, setGraph] = useState<GraphData>(emptyGraph)
  const [namespace, setNamespace] = useState('')
  const [repoLabel, setRepoLabel] = useState('Open a repository from the home screen')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const stats = useMemo(() => graph.stats || { nodes: graph.nodes.length, relationships: graph.links.length }, [graph])

  useEffect(() => {
    let cancelled = false

    async function loadGraph() {
      const params = new URLSearchParams(window.location.search)
      let nextNamespace = params.get('namespace') || ''
      let storedGraph: GraphData | null = null

      try {
        const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
        if (stored) {
          const workspace = JSON.parse(stored) as StoredWorkspace
          const selectedSession =
            workspace.sessions?.find((session) => session.namespace === nextNamespace) ||
            workspace.sessions?.find((session) => session.id === workspace.selectedSessionId) ||
            workspace.sessions?.[0]

          nextNamespace = nextNamespace || selectedSession?.namespace || ''
          storedGraph = workspace.data?.graph || null

          if (!cancelled) {
            setNamespace(nextNamespace)
            setRepoLabel(selectedSession?.name || 'Open a repository from the home screen')
            if (storedGraph) {
              setGraph(storedGraph)
            } else if (workspace.graphStats) {
              setGraph({ ...emptyGraph, stats: workspace.graphStats })
            }
          }
        } else if (!cancelled) {
          setNamespace(nextNamespace)
        }
      } catch {
        window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
      }

      if (!nextNamespace) {
        if (!cancelled) setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/graph?namespace=${encodeURIComponent(nextNamespace)}`, { cache: 'no-store' })
        const payload = (await response.json()) as GraphData | { detail?: string }
        if (!response.ok) {
          throw new Error('detail' in payload ? payload.detail || 'Graph load failed' : 'Graph load failed')
        }
        if (!cancelled) {
          setGraph(payload as GraphData)
          setError(null)
        }
      } catch (err) {
        if (!cancelled && !storedGraph) {
          setError(err instanceof Error ? err.message : 'Graph load failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadGraph()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="min-h-screen px-3 py-4 text-white sm:px-4 sm:py-6 lg:px-6">
      <div className="mx-auto max-w-[1500px] rounded-[8px] border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/80" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7" cy="12" r="2" />
                <circle cx="17" cy="7" r="2" />
                <circle cx="17" cy="17" r="2" />
                <path d="m8.7 11 6.1-3" />
                <path d="m8.7 13 6.1 3" />
              </svg>
            </div>
            <p className="text-sm uppercase tracking-[0.16em] text-[var(--text-secondary)]">Knowledge Graph</p>
            <h1 className="mt-3 text-[1.8rem] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[2.4rem]">
              Full Graph View
            </h1>
            <p className="mt-4 max-w-3xl leading-[1.45] text-[var(--text-secondary)]">
              {namespace ? 'Explore the indexed graph for the active repository session.' : 'Run a query from the home screen to populate the graph.'}
            </p>
          </div>
          <Link
            href="/"
            className="w-full rounded-[6px] border border-transparent bg-[var(--button-primary)] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[var(--button-primary-hover)] sm:w-auto"
          >
            Back Home
          </Link>
        </div>

        <div className="mt-6 rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-2 text-sm text-[var(--text-secondary)] sm:flex-row sm:flex-wrap sm:gap-6">
            <span>Repo: {repoLabel}</span>
            <span>Namespace: {namespace || 'Active in your current session only'}</span>
            <span>Nodes: {stats.nodes} | Edges: {stats.relationships}</span>
          </div>
          <GraphPanel graph={graph} heightClass="h-[420px] sm:h-[520px] xl:h-[720px]" />
          {loading ? <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading graph...</p> : null}
          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        </div>
      </div>
    </main>
  )
}
