export type RetrievedItem = {
  kind: string
  repo: string
  path: string
  symbol?: string | null
  score: number
  content: string
  metadata: Record<string, unknown>
}

export type AnswerResponse = {
  answer: string
  cypher_context: RetrievedItem[]
  vector_context: RetrievedItem[]
  graph: {
    nodes: Array<Record<string, unknown>>
    links: Array<Record<string, unknown>>
    stats: { nodes: number; relationships: number }
  }
}

export type CleanupResponse = {
  namespace: string
  deleted_nodes: number
}

export type IngestedRepo = {
  repo: string
  namespace: string
  files_indexed: number
  local_path: string
  graph: {
    nodes: Array<Record<string, unknown>>
    links: Array<Record<string, unknown>>
    stats: { nodes: number; relationships: number }
  }
}

export type IngestResponse = {
  indexed: IngestedRepo[]
}
