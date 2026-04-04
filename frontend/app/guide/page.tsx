'use client'

import Link from 'next/link'

const capabilities = [
  'Index a public GitHub repository into a graph of repositories, files, and symbols.',
  'Retrieve code evidence with both structural graph search and semantic vector search.',
  'Explain architecture, responsibilities, and code flow using grounded repository context.',
  'Surface relevant files, symbols, and code snippets for debugging and exploration.',
]

const exampleQuestions = [
  'What does this project do end to end?',
  'How does authentication flow through the system?',
  'How does data move from API routes to services and storage?',
  'Which files define the main entry points and request handlers?',
  'Where are the core services, models, and background jobs?',
  'How are repositories cloned, parsed, indexed, and queried in this app?',
  'Which parts of the code are responsible for retrieval and answer generation?',
  'What is the role of Neo4j, Tree-sitter, and OpenAI in this architecture?',
]

const questionTips = [
  'Ask about flows: authentication, routing, ingestion, storage, retrieval.',
  'Ask about structure: entry points, major modules, services, models, APIs.',
  'Ask about ownership: which files or symbols handle a feature.',
  'Ask about behavior: how a request, event, or pipeline moves through the codebase.',
]

export default function GuidePage() {
  return (
    <main className="min-h-screen px-4 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-7xl rounded-[8px] border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/80" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v12" />
                <path d="M6 12h12" />
                <path d="M5 5h14v14H5z" />
              </svg>
            </div>
            <p className="text-sm uppercase tracking-[0.16em] text-[var(--text-secondary)]">Guide</p>
            <h1 className="mt-3 text-[2.4rem] font-semibold leading-none tracking-[-0.02em] text-white">
              What You Can Ask
            </h1>
            <p className="mt-4 max-w-3xl leading-[1.45] text-[var(--text-secondary)]">
              Use this page as a quick reference for what the project can do and which repository questions tend to produce the strongest grounded answers.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-[6px] border border-transparent bg-[var(--button-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--button-primary-hover)]"
          >
            Back Home
          </Link>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-4 sm:p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-[var(--text-secondary)]">Capabilities</p>
            <h2 className="mt-3 text-[1.65rem] font-semibold leading-none tracking-[-0.02em] text-white">
              What This Project Can Do
            </h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {capabilities.map((item) => (
                <div
                  key={item}
                  className="rounded-[4px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm leading-[1.5] text-white/88"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-4 sm:p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-[var(--text-secondary)]">Tips</p>
            <h2 className="mt-3 text-[1.65rem] font-semibold leading-none tracking-[-0.02em] text-white">
              Good Question Patterns
            </h2>
            <div className="mt-5 space-y-3">
              {questionTips.map((item) => (
                <div key={item} className="rounded-[4px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm leading-[1.45] text-white/82">
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-4 rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-4 sm:p-6">
          <p className="text-sm uppercase tracking-[0.16em] text-[var(--text-secondary)]">Examples</p>
          <h2 className="mt-3 text-[1.65rem] font-semibold leading-none tracking-[-0.02em] text-white">
            Example Questions
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {exampleQuestions.map((item) => (
              <div
                key={item}
                className="rounded-[4px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-4 text-sm leading-[1.5] text-white/84"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
