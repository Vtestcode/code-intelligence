'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import type { AnswerResponse, RetrievedItem } from '@/lib/types'

type StoredWorkspace = {
  sessions?: Array<{
    id: string
    name: string
    namespace: string
    repoUrl: string
    filesIndexed: number
  }>
  selectedSessionId?: string
  data?: AnswerResponse | null
}

type EvidenceBlock = RetrievedItem & {
  source: 'Graph' | 'Vector'
}

const WORKSPACE_STORAGE_KEY = 'code-intel-workspace'

function formatScore(score: number) {
  return Number.isFinite(score) ? score.toFixed(3) : '0.000'
}

function formatMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (!entries.length) return ''
  return JSON.stringify(Object.fromEntries(entries), null, 2)
}

export default function ContextPage() {
  const [answerData, setAnswerData] = useState<AnswerResponse | null>(null)
  const [repoLabel, setRepoLabel] = useState('Open a repository from the home screen')
  const [namespace, setNamespace] = useState('')
  const [hydrated, setHydrated] = useState(false)

  const evidence = useMemo<EvidenceBlock[]>(() => {
    if (!answerData) return []
    return [
      ...answerData.cypher_context.map((item) => ({ ...item, source: 'Graph' as const })),
      ...answerData.vector_context.map((item) => ({ ...item, source: 'Vector' as const })),
    ]
  }, [answerData])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
      if (!stored) return

      const workspace = JSON.parse(stored) as StoredWorkspace
      const selectedSession =
        workspace.sessions?.find((session) => session.id === workspace.selectedSessionId) ||
        workspace.sessions?.[0]

      setAnswerData(workspace.data || null)
      setRepoLabel(selectedSession?.name || 'Open a repository from the home screen')
      setNamespace(selectedSession?.namespace || '')
    } catch {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    } finally {
      setHydrated(true)
    }
  }, [])

  return (
    <main className="min-h-screen px-3 py-4 text-white sm:px-4 sm:py-6 lg:px-6">
      <div className="mx-auto max-w-7xl rounded-[8px] border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/80" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 4H5a2 2 0 0 0-2 2v4" />
                <path d="M15 4h4a2 2 0 0 1 2 2v4" />
                <path d="M9 20H5a2 2 0 0 1-2-2v-4" />
                <path d="M15 20h4a2 2 0 0 0 2-2v-4" />
                <path d="M8 12h8" />
                <path d="M12 8v8" />
              </svg>
            </div>
            <p className="text-sm uppercase tracking-[0.16em] text-[var(--text-secondary)]">Retrieved Context</p>
            <h1 className="mt-3 text-[1.8rem] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[2.4rem]">
              Evidence View
            </h1>
            <p className="mt-4 max-w-3xl leading-[1.45] text-[var(--text-secondary)]">
              {evidence.length ? `Review ${evidence.length} retrieved evidence blocks from the active answer.` : 'Run a query from the home screen to populate evidence.'}
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
            <span>Evidence: {evidence.length}</span>
          </div>

          {!hydrated ? (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-base)] p-4 text-base leading-[1.45] text-[var(--text-secondary)] sm:p-6">
              Loading retrieved evidence...
            </div>
          ) : evidence.length ? (
            <div className="grid gap-4">
              {evidence.map((item, index) => {
                const metadata = formatMetadata(item.metadata)
                return (
                  <article key={`${item.source}-${item.repo}-${item.path}-${item.symbol || index}-${index}`} className="overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg-base)]">
                    <div className="border-b border-[var(--border)] p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-[6px] border border-[var(--border)] bg-[var(--panel-muted)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/80">
                              {item.source}
                            </span>
                            <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">{item.kind}</span>
                          </div>
                          <h2 className="mt-3 break-words text-lg font-semibold text-white">{item.symbol || item.path || item.repo}</h2>
                          <p className="mt-2 break-all text-sm leading-[1.45] text-[var(--text-secondary)]">
                            {item.repo} / {item.path}
                          </p>
                        </div>
                        <p className="shrink-0 rounded-[6px] border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-1.5 text-sm font-semibold text-white/82">
                          Score {formatScore(item.score)}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 p-4 sm:p-5">
                      <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap break-words rounded-[8px] border border-[var(--border)] bg-[#080808] p-4 text-sm leading-[1.55] text-white/86">
                        <code>{item.content || 'No snippet content returned for this evidence block.'}</code>
                      </pre>
                      {metadata ? (
                        <details className="rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-4 text-sm text-[var(--text-secondary)]">
                          <summary className="cursor-pointer font-semibold text-white/82">Metadata</summary>
                          <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs leading-[1.5] text-[var(--text-secondary)]">
                            <code>{metadata}</code>
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-base)] p-4 text-base leading-[1.45] text-[var(--text-secondary)] sm:p-6">
              Ask a question from the home screen to inspect retrieved snippets, scores, file paths, and symbol references.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
