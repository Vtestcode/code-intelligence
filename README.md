# Code Intelligence GraphRAG System

A fullstack GraphRAG application that clones GitHub repositories, parses source code with Tree-sitter, stores repository structure and symbols in Neo4j AuraDB, retrieves evidence with hybrid graph + vector search, and answers architecture/code questions using OpenAI models through LangChain.

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