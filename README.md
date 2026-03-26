# Code Intelligence GraphRAG

A full-stack GraphRAG application that clones GitHub repositories, parses code with Tree-sitter, stores repository structure and symbols in Neo4j, retrieves evidence with graph plus vector search, and answers architecture and code-understanding questions with OpenAI models through LangChain.

## What It Does

- Indexes public GitHub repositories into a graph of repositories, files, and symbols.
- Uses hybrid retrieval: structural Cypher search plus semantic vector search.
- Answers repository questions with grounded code evidence.
- Falls back to repository overview evidence for broad questions like "What does this project do?"
- Visualizes the indexed graph and retrieved context in the frontend.
- Exposes retrieval functionality through an MCP server.

## Stack

- Backend: FastAPI, LangChain, Neo4j, OpenAI, Tree-sitter
- Frontend: Next.js 14, TypeScript, Tailwind, Framer Motion
- Deployment: Heroku for backend, Vercel for frontend

## Project Structure

```text
.
├── backend/
│   ├── evaluation/
│   ├── ingestion/
│   ├── retrieval/
│   ├── config.py
│   ├── main.py
│   ├── mcp_server.py
│   ├── models.py
│   ├── requirements.txt
│   └── services.py
├── frontend/
│   ├── app/
│   │   ├── api/
│   │   ├── context/
│   │   ├── graph/
│   │   ├── guide/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   └── lib/
├── Aptfile
├── Procfile
├── README.md
└── requirements.txt
```

## How It Works

1. `POST /ingest` clones one or more repositories and parses supported source files.
2. The backend creates Neo4j nodes for repositories, files, and symbols, then stores symbol embeddings for vector search.
3. `POST /ask` runs graph retrieval and vector retrieval, then adds repository overview context for broader questions.
4. The LLM answers strictly from the retrieved evidence and cites repository paths and symbols inline.
5. The frontend provides:
   - a home page for ingesting a repo and asking questions
   - a graph page for visual exploration
   - a context page for retrieved evidence
   - a guide page with example question patterns

## Example Questions

- What does this project do end to end?
- How does authentication flow through the system?
- Which files define the API routes and request handlers?
- Where are the main services, models, and storage layers?
- How are repositories cloned, parsed, indexed, and queried in this app?

## Local Setup

### 1. Configure environment

From the repo root:

```bash
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
cp backend/repos.txt.example backend/repos.txt
```

Fill in:

- Neo4j credentials
- OpenAI API key
- `BACKEND_URL` for the frontend when pointing to a hosted backend
- `REPO_INDEX_ROOT`
  - local Windows example: your temp directory
  - Heroku example: `/tmp/code-intel-repos`

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
cd backend
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

## API

### Ingest repositories

```bash
curl -X POST http://127.0.0.1:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "repo_urls": [
      "https://github.com/fastapi/fastapi"
    ],
    "namespace": "demo"
  }'
```

### Ask a question

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What does this project do end to end?",
    "namespace": "demo"
  }'
```

### Other routes

- `GET /health`
- `GET /graph/summary?namespace=...`
- `POST /cleanup`
- `POST /evaluate`

## Deployment

### Backend on Heroku

This repo deploys the backend from the repo root. The root deploy files are:

- `Procfile`
- `Aptfile`
- `requirements.txt`
- `.python-version`

The app process itself runs from `backend/`.

If you already have the Heroku app `code-intelligence-480d882a9215`:

```powershell
& "C:\Program Files\heroku\bin\heroku.cmd" login
& "C:\Program Files\heroku\bin\heroku.cmd" git:remote -a code-intelligence-480d882a9215
& "C:\Program Files\heroku\bin\heroku.cmd" buildpacks:clear -a code-intelligence-480d882a9215
& "C:\Program Files\heroku\bin\heroku.cmd" buildpacks:add heroku-community/apt -a code-intelligence-480d882a9215
& "C:\Program Files\heroku\bin\heroku.cmd" buildpacks:add heroku/python -a code-intelligence-480d882a9215
& "C:\Program Files\heroku\bin\heroku.cmd" config:set NEO4J_URI=... NEO4J_USERNAME=... NEO4J_PASSWORD=... NEO4J_DATABASE=... OPENAI_API_KEY=... CORS_ORIGINS=... REPO_INDEX_ROOT=/tmp/code-intel-repos -a code-intelligence-480d882a9215
git push heroku main
```

Production backend:

- `https://code-intelligence-480d882a9215.herokuapp.com`

### Frontend on Vercel

Deploy the `frontend/` directory as the Vercel project root and set:

```env
BACKEND_URL=https://code-intelligence-480d882a9215.herokuapp.com
```

Production frontend:

- `https://code-intelligence.vercel.app`

## MCP

Run the MCP server locally:

```bash
cd backend
python mcp_server.py
```

It serves MCP tools over HTTP on port `9000`.

## Notes

- Supported parsing is currently focused on Python and JavaScript-family files included by the ingestion allowlist.
- Large repositories may need more selective chunking, pruning, reranking, or incremental sync.
- The worker process can read `backend/repos.txt` for background ingestion.

## Next Improvements

- Add richer TypeScript and TSX symbol extraction.
- Resolve `CALLS` edges to internal symbols when possible.
- Add incremental re-indexing and commit-aware sync.
- Add reranking and caching for larger repositories.
- Add auth and per-user workspaces.
