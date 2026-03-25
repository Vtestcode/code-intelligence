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
      <div className="mx-auto max-w-7xl rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,42,0.95),rgba(10,13,24,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/75">Guide</p>
            <h1 className="mt-3 font-[var(--font-display)] text-[3rem] font-bold leading-none tracking-[-0.04em] text-white">
              What You Can Ask
            </h1>
            <p className="mt-4 max-w-3xl text-white/65">
              Use this page as a quick reference for what the project can do and which repository questions tend to produce the strongest grounded answers.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-[1rem] border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Back Home
          </Link>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[1.9rem] border border-white/8 bg-white/[0.03] p-6">
            <p className="text-sm uppercase tracking-[0.22em] text-cyan-300/72">Capabilities</p>
            <h2 className="mt-3 font-[var(--font-display)] text-[2rem] font-bold leading-none tracking-[-0.04em] text-white">
              What This Project Can Do
            </h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {capabilities.map((item) => (
                <div
                  key={item}
                  className="rounded-[1rem] border border-cyan-300/16 bg-cyan-300/8 px-4 py-3 text-sm leading-relaxed text-cyan-50/92"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.9rem] border border-white/8 bg-white/[0.03] p-6">
            <p className="text-sm uppercase tracking-[0.22em] text-cyan-300/72">Tips</p>
            <h2 className="mt-3 font-[var(--font-display)] text-[2rem] font-bold leading-none tracking-[-0.04em] text-white">
              Good Question Patterns
            </h2>
            <div className="mt-5 space-y-3">
              {questionTips.map((item) => (
                <div key={item} className="rounded-[1rem] border border-white/8 bg-[#0b101c]/65 px-4 py-3 text-sm text-white/82">
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-[1.9rem] border border-white/8 bg-white/[0.03] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-cyan-300/72">Examples</p>
          <h2 className="mt-3 font-[var(--font-display)] text-[2rem] font-bold leading-none tracking-[-0.04em] text-white">
            Example Questions
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {exampleQuestions.map((item) => (
              <div
                key={item}
                className="rounded-[1rem] border border-white/8 bg-[#0b101c]/65 px-4 py-4 text-sm leading-relaxed text-white/84"
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
