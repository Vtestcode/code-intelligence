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
  user?: AuthUser | null
  neo4j_resume?: {
    attempted: boolean
    resumed: boolean
    message?: string | null
  }
  graph: {
    nodes: Array<Record<string, unknown>>
    links: Array<Record<string, unknown>>
    stats: { nodes: number; relationships: number }
  }
}

export type IngestResponse = {
  indexed: IngestedRepo[]
}

export type AuthUser = {
  subject: string
  provider: string
  is_guest: boolean
  name?: string | null
  email?: string | null
  picture?: string | null
}

export type AuthStatusResponse = {
  authenticated: boolean
  user?: AuthUser | null
}

export type AuthTokenResponse = {
  token_type: 'bearer'
  expires_in: number
  user: AuthUser
}

export type PasswordAuthRequest = {
  email: string
  password: string
  name?: string
}
