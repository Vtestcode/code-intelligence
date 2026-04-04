'use client'

import Link from 'next/link'

export default function GraphPage() {
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
              Run a query from the home screen to populate the graph.
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
            <span>Repo: Open a repository from the home screen</span>
            <span>Namespace: Active in your current session only</span>
            <span>Nodes: 0 | Edges: 0</span>
          </div>
          <div className="flex h-[420px] items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--bg-base)] text-center text-[var(--text-secondary)] sm:h-[520px] xl:h-[720px]">
            Run a question from the home screen to view a live graph in the same session.
          </div>
        </div>
      </div>
    </main>
  )
}
