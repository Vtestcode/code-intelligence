# Code Intelligence GraphRAG System

A full-stack GraphRAG application that clones GitHub repositories, parses source code with Tree-sitter, stores repository structure and symbols in Neo4j AuraDB, retrieves evidence with hybrid graph + vector search, and answers architecture/code questions using OpenAI models through LangChain.

## Why this project is portfolio-worthy

- Uses a real graph database instead of a flat vector-only RAG stack.
- Supports structural retrieval and semantic retrieval together.
- Exposes retrieval functions as MCP-compatible tools with FastMCP.
- Includes an evaluation module using RAGAS with an OpenAI-backed judge model.
- Ships with a polished Next.js 14 frontend and Heroku-ready process files.

## Git safety

Before your first commit, keep secrets and local build output out of git:

- `.env` is ignored
- `backend/.venv/` is ignored
- `frontend/node_modules/` and `frontend/.next/` are ignored

If you already staged secrets before adding `.gitignore`, unstage them first:

```bash
git rm --cached .env
```

## Final folder structure

```text
code-intel-graphrag/
├── backend/
│   ├── main.py
│   ├── mcp_server.py
│   ├── config.py
│   ├── models.py
│   ├── services.py
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── repo_cloner.py
│   │   ├── ast_parser.py
│   │   └── graph_builder.py
│   ├── retrieval/
│   │   ├── __init__.py
│   │   ├── cypher_retriever.py
│   │   └── vector_retriever.py
│   ├── evaluation/
│   │   ├── __init__.py
│   │   └── ragas_eval.py
│   ├── requirements.txt
│   └── Procfile
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/
│   │       └── ask/
│   │           └── route.ts
│   ├── components/
│   │   └── GraphPanel.tsx
│   ├── lib/
│   │   └── types.ts
│   ├── package.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── .env.local.example
├── .env.example
├── Procfile
└── README.md
```

## Architecture

1. `POST /ingest` clones one or more repos into `/tmp`, parses Python and JavaScript files, and builds repository, file, symbol, and call-graph nodes in Neo4j.
2. Symbols are embedded with OpenAI embeddings and stored directly on `:Symbol` nodes so Neo4j vector search can rank semantically similar code.
3. `POST /ask` runs both Cypher-based structural retrieval and vector similarity retrieval, then feeds both evidence sets into `gpt-4o-mini` for grounded answers.
4. `backend/mcp_server.py` exposes `graph_search` and `vector_search` as MCP tools.
5. `frontend/app/page.tsx` provides a chat-like interface and a live graph visualization with `react-force-graph-2d`.
6. `POST /evaluate` accepts rows in RAGAS format and evaluates answer quality with an OpenAI-backed LangChain model.

## Important implementation notes

- The code uses Neo4j native vector indexes for symbol embeddings.
- Tree-sitter support is implemented for Python and JavaScript exactly as requested.
- The worker process reads `backend/repos.txt` if present, so you can trigger background indexing in Heroku with a worker dyno.
- AuraDB Free is enough for this portfolio version, but large repositories will need more selective chunking and graph pruning.

## Local setup

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd code-intel-graphrag
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
cp backend/repos.txt.example backend/repos.txt
```

Fill in:
- Neo4j AuraDB credentials.
- OpenAI API key.
- `BACKEND_URL` if your frontend points to a hosted backend.
- `REPO_INDEX_ROOT`
  - Use `/tmp/code-intel-repos` on Heroku.
  - Use your OS temp folder locally on Windows.

### 2. Run the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## API usage

### Ingest repositories

```bash
curl -X POST http://127.0.0.1:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "repo_urls": [
      "https://github.com/fastapi/fastapi",
      "https://github.com/vercel/next.js"
    ],
    "namespace": "demo"
  }'
```

### Ask a question

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How does routing flow from entry points to request handlers?",
    "namespace": "demo"
  }'
```

## Heroku deployment

This repo is easiest to deploy with Heroku for the backend and a separate frontend host.

### Backend on Heroku

If you already have the Heroku app `code-intelligence-480d882a9215`, deploy from the repo root:

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
& "C:\Program Files\heroku\bin\heroku.cmd" login
& "C:\Program Files\heroku\bin\heroku.cmd" git:remote -a code-intelligence-480d882a9215
& "C:\Program Files\heroku\bin\heroku.cmd" buildpacks:clear -a code-intelligence-480d882a9215
& "C:\Program Files\heroku\bin\heroku.cmd" buildpacks:add heroku/python -a code-intelligence-480d882a9215
& "C:\Program Files\heroku\bin\heroku.cmd" config:set NEO4J_URI=... NEO4J_USERNAME=... NEO4J_PASSWORD=... NEO4J_DATABASE=... OPENAI_API_KEY=... CORS_ORIGINS=... REPO_INDEX_ROOT=/tmp/code-intel-repos -a code-intelligence-480d882a9215
git push heroku main
```

Check logs:

```powershell
& "C:\Program Files\heroku\bin\heroku.cmd" logs --tail -a code-intelligence-480d882a9215
```

The root `Procfile` starts the backend from `backend/`, so this Heroku app is meant to host the API.

### Frontend hosting

The current Next.js frontend is best deployed separately and pointed at the Heroku backend with:

```env
BACKEND_URL=https://code-intelligence-480d882a9215.herokuapp.com
```

Vercel is the easiest option for the frontend.

## MCP usage

Run the MCP server locally:

```bash
cd backend
python mcp_server.py
```

It serves MCP tools over HTTP on port `9000`.

## RAGAS input format

Send rows shaped like this to `POST /evaluate`:

```json
[
  {
    "user_input": "How does auth work?",
    "response": "Auth starts in ...",
    "retrieved_contexts": ["context 1", "context 2"],
    "reference": "Expected answer"
  }
]
```

## Recommended next improvements

- Add TypeScript and TSX Tree-sitter grammars.
- Resolve `CALLS` edges to internal symbols instead of temporary external placeholders.
- Add webhook-based repository sync and commit-level re-indexing.
- Add reranking and caching for large graphs.
- Add auth and per-user workspaces.

## Notes on the chosen stack

LangChain provides NVIDIA chat and embedding integrations through `langchain-nvidia-ai-endpoints`. FastMCP exposes Python functions as MCP tools. RAGAS supports passing LangChain LLMs and embeddings directly for evaluation. Neo4j supports native vector indexes for embedding search. citeturn243944search4turn243944search1turn243944search14turn243944search3
