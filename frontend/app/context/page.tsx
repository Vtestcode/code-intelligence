'use client'

import Link from 'next/link'

export default function ContextPage() {
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
              Run a query from the home screen to populate evidence.
            </p>
          </div>
          <Link
            href="/"
            className="w-full rounded-[6px] border border-transparent bg-[var(--button-primary)] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[var(--button-primary-hover)] sm:w-auto"
          >
            Back Home
          </Link>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-4 text-base leading-[1.45] text-[var(--text-secondary)] sm:p-6">
            No retrieved evidence is persisted in the browser. Ask a question from the home screen to inspect the response in the active session.
          </div>
        </div>
      </div>
    </main>
  )
}
