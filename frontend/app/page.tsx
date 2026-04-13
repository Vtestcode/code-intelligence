'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import type { AnswerResponse, AuthStatusResponse, AuthUser, CleanupResponse, GraphData, IngestResponse } from '@/lib/types'

type RepoSession = {
  id: string
  name: string
  namespace: string
  repoUrl: string
  filesIndexed: number
}

type StoredWorkspace = {
  sessions: RepoSession[]
  selectedSessionId: string
  data: AnswerResponse | null
  graphStats: GraphData['stats']
}

const WORKSPACE_STORAGE_KEY = 'code-intel-workspace'
const THEME_STORAGE_KEY = 'code-intel-theme'
const sampleQuestion = 'How does the authentication flow move through controllers, services, and storage?'

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

function initialsForUser(user: AuthUser | null) {
  const label = user?.name || user?.email || 'User'
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return (parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')
}

export default function HomePage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [repoUrl, setRepoUrl] = useState('')
  const [question, setQuestion] = useState(sampleQuestion)
  const [sessions, setSessions] = useState<RepoSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState(0)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [data, setData] = useState<AnswerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [graphStats, setGraphStats] = useState({ nodes: 0, relationships: 0 })
  const [hydrated, setHydrated] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(310)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)

  const activeSession = sessions.find((session) => session.id === selectedSessionId) || null
  const isAuthenticated = Boolean(authUser)
  const userInitials = useMemo(() => initialsForUser(authUser), [authUser])
  const userLabel = authUser?.name || authUser?.email || 'Workspace User'
  const userRoleLabel = authUser ? (authUser.is_guest ? 'Guest Session' : `${authUser.provider[0].toUpperCase()}${authUser.provider.slice(1)} User`) : 'Anonymous Access'

  const contextCount = useMemo(() => {
    if (!data) return 0
    return data.cypher_context.length + data.vector_context.length
  }, [data])

  function clearWorkspaceState() {
    setSessions([])
    setSelectedSessionId('')
    setData(null)
    setGraphStats({ nodes: 0, relationships: 0 })
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
  }

  async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    return fetch(input, init)
  }

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
      const nextTheme =
        storedTheme === 'light' || storedTheme === 'dark'
          ? storedTheme
          : window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
      setTheme(nextTheme)
      document.documentElement.dataset.theme = nextTheme

      const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<StoredWorkspace>
        if (Array.isArray(parsed.sessions)) {
          setSessions(parsed.sessions)
          setSelectedSessionId(parsed.selectedSessionId || parsed.sessions[0]?.id || '')
          setData(parsed.data || null)
          setGraphStats(parsed.graphStats || parsed.data?.graph?.stats || { nodes: 0, relationships: 0 })
        }
      }
    } catch {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [hydrated, theme])

  useEffect(() => {
    if (!ingesting) {
      setIngestProgress(0)
      return
    }

    setIngestProgress(8)
    const intervalId = window.setInterval(() => {
      setIngestProgress((current) => {
        if (current >= 92) return current
        return Math.min(92, current + Math.max(4, (100 - current) * 0.08))
      })
    }, 450)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [ingesting])

  useEffect(() => {
    if (!hydrated) return

    const workspace: StoredWorkspace = {
      sessions,
      selectedSessionId,
      data,
      graphStats,
    }
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace))
  }, [data, graphStats, hydrated, selectedSessionId, sessions])

  useEffect(() => {
    let cancelled = false

    async function restoreAuthSession() {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
        })
        const payload = (await response.json()) as AuthStatusResponse | { detail?: string }
        if (!response.ok) {
          throw new Error('Unable to restore session')
        }
        if (!cancelled) {
          setAuthUser('authenticated' in payload && payload.authenticated ? payload.user || null : null)
        }
      } catch {
        if (!cancelled) {
          setAuthUser(null)
        }
      }
    }

    restoreAuthSession()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isResizingSidebar) return

    function handlePointerMove(event: MouseEvent) {
      const nextWidth = Math.min(420, Math.max(240, event.clientX - 24))
      setSidebarWidth(nextWidth)
    }

    function handlePointerUp() {
      setIsResizingSidebar(false)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [isResizingSidebar])

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuthUser(null)
    clearWorkspaceState()
    setStatus('Signed out. You can keep using the workspace anonymously or sign in again.')
    setError(null)
  }

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
      const response = await authorizedFetch('/api/ingest', {
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

      setIngestProgress(100)

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
      const resumeStatus = indexedRepo.neo4j_resume?.message ? `${indexedRepo.neo4j_resume.message} ` : ''
      setStatus(`${resumeStatus}Indexed ${nextSession.name} with ${nextSession.filesIndexed} files. Ask your first question when you're ready.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.toLowerCase().includes('neo4j aura resume was requested')) {
        setStatus('Repository indexing is starting up. Give it a moment, then try again.')
        setError(null)
      } else {
        setError(message)
      }
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
      const response = await authorizedFetch('/api/ask', {
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
      const response = await authorizedFetch('/api/cleanup', {
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
      setStatus(`Session ended for ${activeSession.name}. Deleted ${cleanup.deleted_nodes} indexed nodes.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCleaningUp(false)
    }
  }

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return (
    <main className="min-h-screen px-3 py-4 text-[var(--text-primary)] sm:px-4 sm:py-5 lg:px-6">
      <div className="mx-auto max-w-[1760px]">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex flex-col gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--text-primary)]" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 7 4 9.5v5L8 17l4-2.5v-5L8 7Z" />
                <path d="m8 7 4 2.5 4-2.5" />
                <path d="M12 9.5v5" />
                <path d="m16 7 4 2.5v5L16 17l-4-2.5" opacity="0.7" />
              </svg>
            </div>
            <div>
              <p className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)] sm:text-[0.8rem]">
                Code Intelligence
              </p>
              <h1 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">GraphRAG Workspace</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-[6px] border border-[var(--border)] bg-[var(--panel-muted)] text-[var(--text-primary)]/75 transition hover:bg-[var(--hover-muted)]"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v3" />
                <path d="M12 18v3" />
                <path d="M3 12h3" />
                <path d="M18 12h3" />
                <path d="m5.64 5.64 2.12 2.12" />
                <path d="m16.24 16.24 2.12 2.12" />
                <path d="m5.64 18.36 2.12-2.12" />
                <path d="m16.24 7.76 2.12-2.12" />
                <circle cx="12" cy="12" r="3.25" />
              </svg>
            </button>

            {!isAuthenticated ? (
              <Link
                href="/auth"
                className="rounded-[6px] border border-transparent bg-[var(--button-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--button-primary-hover)]"
              >
                Sign In
              </Link>
            ) : null}

            <div className="flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--panel-muted)] px-2 py-1.5 sm:px-3">
              <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[var(--button-primary)] text-[0.72rem] font-semibold text-white">
                {authUser?.picture ? <img src={authUser.picture} alt={userLabel} className="h-full w-full object-cover" /> : userInitials}
              </div>
              <div className="hidden sm:block">
                <p className="text-[0.78rem] font-medium text-[var(--text-primary)]">{userLabel}</p>
                <p className="text-[0.68rem] text-[var(--text-secondary)]">{userRoleLabel}</p>
              </div>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  void handleSignOut()
                }}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--hover-muted)]"
              >
                Sign Out
              </button>
            ) : null}
          </div>
        </motion.header>

        <div className="flex flex-col gap-4 xl:flex-row">
          <motion.aside
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6 xl:w-[310px]"
            style={{ width: `min(100%, ${sidebarWidth}px)` }}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] sm:h-12 sm:w-12">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--text-primary)] sm:h-6 sm:w-6" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 7 4 9.5v5L8 17l4-2.5v-5L8 7Z" />
                  <path d="m8 7 4 2.5 4-2.5" />
                  <path d="M12 9.5v5" />
                  <path d="m16 7 4 2.5v5L16 17l-4-2.5" opacity="0.7" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)] sm:text-[0.86rem]">
                  Code Intelligence
                </p>
                <h2 className="mt-1 text-[1.5rem] font-semibold uppercase leading-[1] tracking-[-0.01em] text-[var(--text-primary)] sm:text-[1.75rem]">
                  GraphRAG
                </h2>
              </div>
            </div>

            <div className="mt-8 sm:mt-12">
              <p className="text-[0.82rem] uppercase tracking-[0.18em] text-[var(--text-secondary)]">Select Repository</p>
              <div className="relative mt-4">
                <select
                  value={selectedSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--panel-muted)] px-4 py-3 pr-12 text-[0.95rem] font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--text-secondary)]"
                >
                  <option value="">Choose an indexed repo</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[var(--text-secondary)]">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 7.5 5 5 5-5" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <p className="text-xs text-[var(--text-secondary)]">
                {isAuthenticated ? 'Requests from this browser will include your session cookie and use a user-scoped namespace.' : 'You can use the app anonymously, or sign in from the top bar to keep user-specific namespaces.'}
              </p>
              <p className="text-sm uppercase tracking-[0.16em] text-[var(--text-muted)]">GitHub Repo URL</p>
              <input
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/owner/repo"
                className="mt-4 w-full rounded-[4px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--text-secondary)]"
              />
              <button
                onClick={handleIngest}
                disabled={ingesting}
                className="relative mt-4 w-full overflow-hidden rounded-[6px] border border-transparent bg-[var(--button-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ingesting ? (
                  <>
                    <motion.span
                      className="absolute inset-y-0 left-0 bg-white/20"
                      initial={{ width: 0 }}
                      animate={{ width: `${ingestProgress}%` }}
                      transition={{ ease: 'easeOut', duration: 0.35 }}
                    />
                    <span className="relative z-[1]">Indexing Repository...</span>
                  </>
                ) : (
                  'Use This Repository'
                )}
              </button>
            </div>

            <div className="mt-8 border-t border-[var(--border)] pt-6 text-sm text-[var(--text-secondary)]">
              {activeSession ? (
                <>
                  <p className="font-semibold text-[var(--text-primary)]">Active Session</p>
                  <p className="mt-3">{activeSession.name}</p>
                  <p className="mt-2 break-all text-[var(--text-muted)]">{activeSession.repoUrl}</p>
                  <p className="mt-2 text-[var(--text-muted)]">Namespace: {activeSession.namespace}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-[var(--text-primary)]">Ready to Index</p>
                  <p className="mt-3 text-[var(--text-secondary)]">Paste a public GitHub repository URL and the app will create a fresh session for that codebase.</p>
                </>
              )}
            </div>
          </motion.aside>

          <div className="hidden xl:flex xl:items-stretch">
            <button
              type="button"
              onMouseDown={() => setIsResizingSidebar(true)}
              aria-label="Resize sidebar"
              className={`group relative mx-1 w-3 cursor-col-resize rounded-full transition ${isResizingSidebar ? 'bg-[var(--panel-muted)]' : 'bg-transparent hover:bg-[var(--panel-muted)]'}`}
            >
              <span className="absolute inset-y-8 left-1/2 w-[1px] -translate-x-1/2 bg-[var(--border)]" />
              <span className="absolute left-1/2 top-1/2 h-16 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--text-secondary)]/30 transition group-hover:bg-[var(--text-secondary)]/60" />
            </button>
          </div>

          <div className="grid min-w-0 flex-1 gap-4 xl:grid-cols-[1.35fr_0.8fr]">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="min-w-0 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6"
            >
              <div className="text-[1.5rem] font-semibold leading-none tracking-[-0.02em] text-[var(--text-primary)] sm:text-[1.85rem]">Ask Your Codebase</div>

              <div className="mt-5 sm:mt-6">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={4}
                  placeholder="Ask an architecture question..."
                  className="min-h-[140px] w-full resize-none rounded-[4px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-[1rem] leading-[1.45] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--text-secondary)] sm:min-h-[170px] sm:py-4 sm:text-[1.15rem]"
                />

                <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:flex-wrap">
                  <button
                    onClick={handleAsk}
                    disabled={loading || !activeSession}
                    className="w-full rounded-[6px] border border-transparent bg-[var(--button-primary)] px-4 py-3 text-base font-semibold text-white transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
                  >
                    {loading ? 'Thinking...' : 'Ask GraphRAG'}
                  </button>

                  <button
                    onClick={handleEndSession}
                    disabled={cleaningUp || !activeSession}
                    className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--panel-muted)] px-4 py-3 text-base font-medium text-[var(--text-primary)] transition hover:bg-[var(--hover-muted)] disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
                  >
                    {cleaningUp ? 'Ending Session...' : 'End Session'}
                  </button>
                </div>

                <div className="mt-7">
                  <p className="text-sm uppercase tracking-[0.16em] text-[var(--text-secondary)]">Answer</p>
                  <div className="mt-3 min-h-[260px] rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-4 sm:min-h-[360px] sm:p-6">
                    {loading ? (
                      <div className="flex min-h-[220px] items-center justify-center sm:min-h-[300px]">
                        <div className="flex flex-col items-center gap-4 text-center">
                          <div className="flex items-center gap-2">
                            {[0, 1, 2].map((dot) => (
                              <motion.span
                                key={dot}
                                className="h-2.5 w-2.5 rounded-full bg-[var(--button-primary)]"
                                animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
                                transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.14, ease: 'easeInOut' }}
                              />
                            ))}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white sm:text-base">GraphRAG is analyzing your repository</p>
                            <p className="mt-1 text-xs leading-[1.5] text-[var(--text-secondary)] sm:text-sm">
                              Retrieving graph context, embedding matches, and generating a grounded answer.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-[0.95rem] leading-[1.55] text-white/86 sm:text-[1.05rem]">
                        {data?.answer || 'Index a repository, ask a question, and your grounded answer will appear here.'}
                      </p>
                    )}
                  </div>
                </div>

                {error ? <p className="mt-5 text-sm text-rose-300">{error}</p> : null}
                {status ? <p className="mt-5 text-sm text-emerald-300">{status}</p> : null}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="min-w-0 space-y-4"
            >
              <div className="min-w-0 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-4 grid h-9 w-9 place-items-center rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/80" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                        <path d="M12 2a6 6 0 0 0-3 11.2c.6.35 1 1 1 1.7V16h4v-1.1c0-.7.4-1.35 1-1.7A6 6 0 0 0 12 2Z" />
                      </svg>
                    </div>
                    <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Start Here</p>
                    <h2 className="mt-3 text-[1.45rem] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[1.75rem]">
                      Need Question Ideas?
                    </h2>
                    <p className="mt-3 text-sm leading-[1.45] text-[var(--text-secondary)]">
                      Open the guide page for sample prompts, supported use cases, and examples of strong repository questions.
                    </p>
                  </div>
                  <Link
                    href="/guide"
                    className="w-full rounded-[6px] border border-transparent bg-[var(--button-primary)] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[var(--button-primary-hover)] sm:w-auto"
                  >
                    Open Guide
                  </Link>
                </div>
              </div>

              <div className="min-w-0 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-4 grid h-9 w-9 place-items-center rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/80" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="7" cy="12" r="2" />
                        <circle cx="17" cy="7" r="2" />
                        <circle cx="17" cy="17" r="2" />
                        <path d="m8.7 11 6.1-3" />
                        <path d="m8.7 13 6.1 3" />
                      </svg>
                    </div>
                    <h2 className="text-[1.55rem] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[1.8rem]">
                      Knowledge Graph
                    </h2>
                    <p className="mt-3 text-sm leading-[1.45] text-[var(--text-secondary)]">
                      {graphStats.nodes} nodes and {graphStats.relationships} edges ready to inspect.
                    </p>
                  </div>
                  <Link
                    href={activeSession ? `/graph?namespace=${encodeURIComponent(activeSession.namespace)}` : '/graph'}
                    className="w-full rounded-[6px] border border-transparent bg-[var(--button-primary)] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[var(--button-primary-hover)] sm:w-auto"
                  >
                    View
                  </Link>
                </div>
                <div className="mt-5 border-t border-[var(--border)] pt-4">
                  <p className="text-base leading-[1.45] text-white/78">
                    Open the full graph page to explore the live network visualization for the latest answer.
                  </p>
                </div>
              </div>

              <div className="min-w-0 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-4 grid h-9 w-9 place-items-center rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/80" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 4H5a2 2 0 0 0-2 2v4" />
                        <path d="M15 4h4a2 2 0 0 1 2 2v4" />
                        <path d="M9 20H5a2 2 0 0 1-2-2v-4" />
                        <path d="M15 20h4a2 2 0 0 0 2-2v-4" />
                        <path d="M8 12h8" />
                        <path d="M12 8v8" />
                      </svg>
                    </div>
                    <h2 className="text-[1.55rem] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[1.8rem]">
                      Retrieved Context
                    </h2>
                    <p className="mt-3 text-sm leading-[1.45] text-[var(--text-secondary)]">{contextCount} evidence blocks captured from graph and vector search.</p>
                  </div>
                  <Link
                    href="/context"
                    className="w-full rounded-[6px] border border-transparent bg-[var(--button-primary)] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[var(--button-primary-hover)] sm:w-auto"
                  >
                    View
                  </Link>
                </div>
                <div className="mt-5 border-t border-[var(--border)] pt-4">
                  <p className="text-base leading-[1.45] text-white/78">
                    Open the context page to review every retrieved snippet, score, file path, and symbol reference.
                  </p>
                </div>
              </div>
            </motion.section>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-3 left-3 z-10 hidden sm:block">
        <div className="flex items-start gap-2 rounded-[6px] border border-[var(--border)] bg-[rgba(26,26,26,0.92)] px-2.5 py-2 text-white/80 backdrop-blur">
          <div className="grid h-6 w-6 place-items-center rounded-[6px] border border-[var(--border)] bg-[var(--panel-muted)]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white/75" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h7" />
              <path d="M14 6h7" />
              <path d="M14 18h7" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          </div>
          <div className="leading-[1.2]">
            <p className="text-[11px] font-semibold text-white">Powered by Neo4j & OpenAI</p>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">Graph retrieval, code embeddings, and grounded architecture answers.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
