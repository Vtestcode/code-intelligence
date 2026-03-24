'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import type { AnswerResponse, CleanupResponse, IngestResponse } from '@/lib/types'

type RepoSession = {
  id: string
  name: string
  namespace: string
  repoUrl: string
  filesIndexed: number
}

const sampleQuestion = 'How does the authentication flow move through controllers, services, and storage?'
const STORAGE_KEY = 'code-intel-last-answer'
const SESSION_STORAGE_KEY = 'code-intel-session-state'

function extractRepoName(repoUrl: string) {
  const cleaned = repoUrl.trim().replace(/\/$/, '')
  const last = cleaned.split('/').pop() || 'repository'
  return last.replace(/\.git$/, '') || 'repository'
}

function buildNamespace(repoUrl: string) {
  const base = extractRepoName(repoUrl)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'repo'}-${Date.now()}`
}

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState('')
  const [question, setQuestion] = useState(sampleQuestion)
  const [sessions, setSessions] = useState<RepoSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [data, setData] = useState<AnswerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [graphStats, setGraphStats] = useState({ nodes: 0, relationships: 0 })
  const [hydrated, setHydrated] = useState(false)

  const activeSession = sessions.find((session) => session.id === selectedSessionId) || null

  const contextCount = useMemo(() => {
    if (!data) return 0
    return data.cypher_context.length + data.vector_context.length
  }, [data])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    const answerRaw = window.localStorage.getItem(STORAGE_KEY)

    try {
      if (raw) {
        const parsed = JSON.parse(raw) as {
          sessions?: RepoSession[]
          selectedSessionId?: string
          graphStats?: { nodes: number; relationships: number }
        }
        setSessions(parsed.sessions || [])
        setSelectedSessionId(parsed.selectedSessionId || '')
        setGraphStats(parsed.graphStats || { nodes: 0, relationships: 0 })
      }

      if (answerRaw) {
        const parsedAnswer = JSON.parse(answerRaw) as {
          data?: AnswerResponse
          question?: string
          session?: { id?: string; namespace?: string } | null
        }
        if (parsedAnswer.data) {
          setData(parsedAnswer.data)
          setGraphStats(parsedAnswer.data.graph?.stats || { nodes: 0, relationships: 0 })
        }
        if (parsedAnswer.question) {
          setQuestion(parsedAnswer.question)
        }
        if (parsedAnswer.session?.id) {
          setSelectedSessionId(parsedAnswer.session.id)
        }
      }
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      window.localStorage.removeItem(STORAGE_KEY)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !hydrated) return
    if (!data) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        data,
        session: activeSession,
        question,
      }),
    )
  }, [activeSession, data, hydrated, question])

  useEffect(() => {
    if (typeof window === 'undefined' || !hydrated) return
    if (!sessions.length && !selectedSessionId && graphStats.nodes === 0 && graphStats.relationships === 0) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        sessions,
        selectedSessionId,
        graphStats,
      }),
    )
  }, [graphStats, hydrated, selectedSessionId, sessions])

  async function handleIngest() {
    const trimmedRepoUrl = repoUrl.trim()
    if (!trimmedRepoUrl) {
      setError('Enter a GitHub repository URL to begin.')
      return
    }

    const namespace = buildNamespace(trimmedRepoUrl)
    setIngesting(true)
    setError(null)
    setStatus(null)
    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_urls: [trimmedRepoUrl],
          namespace,
        }),
      })

      const payload = (await response.json()) as IngestResponse | { detail?: string }
      if (!response.ok) {
        throw new Error('detail' in payload ? payload.detail || 'Repository ingest failed' : 'Repository ingest failed')
      }

      const indexedRepo = (payload as IngestResponse).indexed[0]
      if (!indexedRepo) {
        throw new Error('The repository was submitted, but no indexed result was returned.')
      }

      const nextSession: RepoSession = {
        id: namespace,
        name: indexedRepo.repo,
        namespace: indexedRepo.namespace,
        repoUrl: trimmedRepoUrl,
        filesIndexed: indexedRepo.files_indexed,
      }

      setSessions((current) => [nextSession, ...current.filter((session) => session.namespace !== nextSession.namespace)])
      setSelectedSessionId(nextSession.id)
      setData(null)
      setGraphStats(indexedRepo.graph.stats)
      setRepoUrl('')
      setStatus(`Indexed ${nextSession.name} with ${nextSession.filesIndexed} files. Ask your first question when you're ready.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIngesting(false)
    }
  }

  async function handleAsk() {
    if (!activeSession) {
      setError('Add a GitHub repository first so the app knows what codebase to search.')
      return
    }

    setLoading(true)
    setError(null)
    setStatus(null)
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          namespace: activeSession.namespace,
          max_context_items: 8,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || 'Request failed')
      setData(payload)
      setGraphStats(payload.graph?.stats || { nodes: 0, relationships: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleEndSession() {
    if (!activeSession) {
      setError('Select an indexed repository before ending a session.')
      return
    }

    setCleaningUp(true)
    setError(null)
    setStatus(null)
    try {
      const response = await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace: activeSession.namespace }),
      })
      const payload = (await response.json()) as CleanupResponse | { detail?: string }
      if (!response.ok) throw new Error('detail' in payload ? payload.detail || 'Cleanup failed' : 'Cleanup failed')

      const cleanup = payload as CleanupResponse
      let nextSelectedSessionId = ''
      setSessions((current) => {
        const remaining = current.filter((session) => session.id !== activeSession.id)
        nextSelectedSessionId = remaining[0]?.id || ''
        return remaining
      })
      setSelectedSessionId((current) => (current === activeSession.id ? nextSelectedSessionId : current))
      setData(null)
      setGraphStats({ nodes: 0, relationships: 0 })
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY)
        if (!nextSelectedSessionId) {
          window.localStorage.removeItem(SESSION_STORAGE_KEY)
        }
      }
      setStatus(`Session ended for ${activeSession.name}. Deleted ${cleanup.deleted_nodes} indexed nodes.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCleaningUp(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 text-white lg:px-6">
      <div className="mx-auto flex max-w-[1760px] flex-col gap-5 xl:flex-row">
        <motion.aside
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,24,42,0.94),rgba(11,16,28,0.94))] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.35)] xl:w-[310px]"
        >
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <svg viewBox="0 0 64 64" className="h-10 w-10 text-white/90" aria-hidden="true">
                <path d="M10 16 26 8v34L10 50Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M26 8 42 16v34L26 42Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M42 16 54 22v34L42 50Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" opacity="0.7" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-[var(--font-display)] text-[0.92rem] font-medium uppercase tracking-[0.34em] text-cyan-300/78">
                Code Intelligence
              </p>
              <h1 className="mt-1 font-[var(--font-display)] text-[2.25rem] font-bold uppercase leading-[0.88] tracking-[-0.03em] text-white">
                GraphRAG
              </h1>
            </div>
          </div>

          <div className="mt-14">
            <p className="text-[0.85rem] uppercase tracking-[0.28em] text-cyan-300/75">Select Repository</p>
            <div className="relative mt-4">
              <select
                value={selectedSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}
                className="w-full rounded-[1.25rem] border border-white/8 bg-[#131c33] px-5 py-3 pr-14 text-base font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition focus:border-cyan-300/50"
              >
                <option value="">Choose an indexed repo</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-white/60">v</div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <p className="text-sm uppercase tracking-[0.24em] text-white/45">GitHub Repo URL</p>
            <input
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="https://github.com/owner/repo"
              className="mt-4 w-full rounded-[1.15rem] border border-white/10 bg-[#090d18] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/55"
            />
            <button
              onClick={handleIngest}
              disabled={ingesting}
              className="mt-4 w-full rounded-[1.15rem] bg-[linear-gradient(90deg,#2ce2ff,#47c4ff)] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ingesting ? 'Indexing Repository...' : 'Use This Repository'}
            </button>
          </div>

          <div className="mt-8 border-t border-white/8 pt-6 text-sm text-white/72">
            {activeSession ? (
              <>
                <p className="font-semibold text-white">Active Session</p>
                <p className="mt-3">{activeSession.name}</p>
                <p className="mt-2 break-all text-white/45">{activeSession.repoUrl}</p>
                <p className="mt-2 text-white/45">Namespace: {activeSession.namespace}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-white">Ready to Index</p>
                <p className="mt-3 text-white/55">Paste a public GitHub repository URL and the app will create a fresh session for that codebase.</p>
              </>
            )}
          </div>
        </motion.aside>

        <div className="grid min-w-0 flex-1 gap-5 xl:grid-cols-[1.35fr_0.8fr]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0 overflow-hidden rounded-[2.2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,16,26,0.96),rgba(10,13,24,0.96))] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.4)]"
          >
            <div className="font-[var(--font-display)] text-[2.35rem] font-bold leading-none tracking-[-0.04em] text-white sm:text-[3rem]">Inter/Geist</div>

            <div className="mt-8">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={4}
                placeholder="Ask an architecture question..."
                className="min-h-[190px] w-full resize-none rounded-[1.7rem] border border-cyan-300/85 bg-[#0d1322] px-6 py-5 text-[2rem] leading-tight text-white shadow-[0_0_0_1px_rgba(44,226,255,0.18),0_0_28px_rgba(44,226,255,0.35),inset_0_0_24px_rgba(44,226,255,0.08)] outline-none placeholder:text-white/45"
              />

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handleAsk}
                  disabled={loading || !activeSession}
                  className="rounded-[1rem] bg-[linear-gradient(90deg,#2ce2ff,#48ccff)] px-5 py-3 text-lg font-semibold text-slate-950 transition hover:scale-[1.01] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loading ? 'Thinking...' : 'Ask GraphRAG'}
                </button>

                <button
                  onClick={handleEndSession}
                  disabled={cleaningUp || !activeSession}
                  className="rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(82,88,104,0.82),rgba(59,65,81,0.82))] px-5 py-3 text-lg font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {cleaningUp ? 'Ending Session...' : 'End Session'}
                </button>
              </div>

              <div className="mt-8">
                <p className="text-sm uppercase tracking-[0.22em] text-cyan-300/70">Answer</p>
                <div className="mt-4 min-h-[360px] rounded-[1.4rem] bg-[#0b101c]/70 p-6">
                  <p className="whitespace-pre-wrap text-xl leading-relaxed text-white/86">
                    {data?.answer || 'Index a repository, ask a question, and your grounded answer will appear here.'}
                  </p>
                </div>
              </div>

              {error ? <p className="mt-5 text-sm text-rose-300">{error}</p> : null}
              {status ? <p className="mt-5 text-sm text-emerald-300">{status}</p> : null}

              <div className="mt-8 flex items-center gap-4 border-t border-white/8 pt-6 text-white/82">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl">[]</div>
                <div>
                  <p className="text-xl font-semibold">Powered by Neo4j & OpenAI</p>
                  <p className="text-sm text-white/48">Graph retrieval, code embeddings, and grounded architecture answers.</p>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="min-w-0 space-y-5"
          >
            <div className="min-w-0 overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(49,56,70,0.88),rgba(31,37,49,0.88))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.34)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-[var(--font-display)] text-[1.95rem] font-bold leading-none tracking-[-0.04em] text-white sm:text-[2.25rem] xl:text-[2.4rem]">
                    Knowledge Graph
                  </h2>
                  <p className="mt-3 text-sm text-white/58">
                    {graphStats.nodes} nodes and {graphStats.relationships} edges ready to inspect.
                  </p>
                </div>
                <Link
                  href="/graph"
                  className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                >
                  View
                </Link>
              </div>
              <div className="mt-6 border-t border-white/8 pt-5">
                <p className="text-lg text-white/78">
                  Open the full graph page to explore the live network visualization for the latest answer.
                </p>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(49,56,70,0.88),rgba(31,37,49,0.88))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.34)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-[var(--font-display)] text-[1.95rem] font-bold leading-none tracking-[-0.04em] text-white sm:text-[2.25rem] xl:text-[2.4rem]">
                    Retrieved Context
                  </h2>
                  <p className="mt-3 text-sm text-white/58">{contextCount} evidence blocks captured from graph and vector search.</p>
                </div>
                <Link
                  href="/context"
                  className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                >
                  View
                </Link>
              </div>
              <div className="mt-6 border-t border-white/8 pt-5">
                <p className="text-lg text-white/78">
                  Open the context page to review every retrieved snippet, score, file path, and symbol reference.
                </p>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  )
}
