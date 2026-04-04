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
- Optional Neo4j Aura API credentials if you want the backend to auto-resume a paused Aura instance before indexing.
- OpenAI API key.
- JWT settings and optional Google client ID if you want sign-in.
- `DATABASE_URL` if you want to persist users in Heroku Postgres.
- `BACKEND_URL` if your frontend points to a hosted backend.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` if you want the frontend to render the Google sign-in button.
- `REPO_INDEX_ROOT`
  - Use `/tmp/code-intel-repos` on Heroku.
  - Use your OS temp folder locally on Windows.

Aura auto-resume env vars:
- `NEO4J_AURA_CLIENT_ID`
- `NEO4J_AURA_CLIENT_SECRET`
- `NEO4J_AURA_INSTANCE_ID`
- `NEO4J_AURA_AUTO_RESUME=true`

If `NEO4J_AURA_INSTANCE_ID` is omitted, the backend will try to infer it from the Aura hostname in `NEO4J_URI`.

Optional auth env vars:
- `JWT_SECRET`
- `JWT_ALGORITHM=HS256`
- `JWT_EXPIRATION_HOURS=24`
- `GUEST_JWT_EXPIRATION_HOURS=168`
- `GOOGLE_CLIENT_ID`
- `DATABASE_URL`

Auth endpoints:
- `POST /auth/guest` issues a guest JWT so users can use the app without creating an account.
- `POST /auth/google` exchanges a Google ID token for an app JWT.
- `POST /auth/register` creates an email/password account and returns an app JWT.
- `POST /auth/login` signs in with email/password and returns an app JWT.
- `GET /auth/me` returns the current authenticated or guest user from the bearer token.

Protected behavior:
- Auth is optional.
- If a bearer token is supplied, repository namespaces are automatically scoped to that user so sessions stay user-specific.
- If `DATABASE_URL` is set, guest and Google users are upserted into Heroku Postgres table `"Code_intelligence_table"`.
- The frontend does not use `localStorage` for auth.
- On Vercel, the frontend stores the backend JWT in an `HttpOnly` cookie and forwards it to Heroku through the Next.js API proxy routes.

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
