from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from neo4j.exceptions import Neo4jError

from config import get_settings
from ingestion.ast_parser import ASTParser
from ingestion.graph_builder import GraphBuilder
from ingestion.repo_cloner import RepoCloner, repo_name_from_url
from models import (
    AnswerResponse,
    GraphSummaryResponse,
    NamespaceCleanupRequest,
    NamespaceCleanupResponse,
    QuestionRequest,
    RepoIngestRequest,
    RetrievedItem,
)
from retrieval.cypher_retriever import CypherRetriever
from retrieval.vector_retriever import VectorRetriever
from services import get_driver, get_llm

settings = get_settings()
logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cloner = RepoCloner()
parser = ASTParser()
builder = GraphBuilder()
vector = VectorRetriever()
graph = CypherRetriever()
llm = get_llm()


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "app": settings.app_name}


@app.post("/ingest")
def ingest_repositories(payload: RepoIngestRequest) -> Dict[str, Any]:
    namespace = payload.namespace or "default"
    processed: List[Dict[str, Any]] = []
    try:
        for repo_url in payload.repo_urls:
            repo_url_str = str(repo_url)
            repo_path = cloner.clone(repo_url_str, ref=payload.ref)
            repo_name = repo_name_from_url(repo_url_str)
            parsed_files = [parser.parse_file(path) for path in cloner.iter_source_files(repo_path)]
            builder.upsert_repository_graph(namespace=namespace, repo_name=repo_name, repo_path=repo_path, parsed_files=parsed_files)
            graph_data = _graph_visual(namespace)
            processed.append(
                {
                    "repo": repo_name,
                    "namespace": namespace,
                    "files_indexed": len(parsed_files),
                    "local_path": str(repo_path),
                    "graph": graph_data,
                }
            )
    except Exception as exc:
        logger.exception("Repository ingest failed")
        raise HTTPException(status_code=500, detail=f"Repository ingest failed: {exc}") from exc
    return {"indexed": processed}


@app.post("/ask", response_model=AnswerResponse)
def ask_question(payload: QuestionRequest) -> AnswerResponse:
    try:
        graph_hits = graph.search(payload.question, namespace=payload.namespace, limit=payload.max_context_items)
        vector_hits = vector.search(payload.question, namespace=payload.namespace, limit=payload.max_context_items)
    except Neo4jError as exc:
        raise HTTPException(status_code=500, detail=f"Neo4j retrieval failed: {exc}") from exc
    except Exception as exc:
        logger.exception("Question retrieval failed")
        raise HTTPException(status_code=500, detail=f"Question retrieval failed: {exc}") from exc

    try:
        prompt = _build_answer_prompt(payload.question, graph_hits, vector_hits)
        answer = llm.invoke(prompt).content
        graph_data = _graph_visual(payload.namespace)
    except Exception as exc:
        logger.exception("Answer generation failed")
        raise HTTPException(status_code=500, detail=f"Answer generation failed: {exc}") from exc
    return AnswerResponse(
        answer=answer,
        cypher_context=[RetrievedItem(**item) for item in graph_hits],
        vector_context=[RetrievedItem(**item) for item in vector_hits],
        graph=graph_data,
    )


@app.get("/graph/summary", response_model=GraphSummaryResponse)
def graph_summary(namespace: str = "default") -> GraphSummaryResponse:
    data = _graph_visual(namespace)
    return GraphSummaryResponse(
        namespace=namespace,
        node_count=data["stats"]["nodes"],
        relationship_count=data["stats"]["relationships"],
        repos=sorted({n["repo"] for n in data["nodes"] if n.get("repo")}),
        sample_nodes=data["nodes"][:12],
    )


@app.post("/evaluate")
def evaluate_answers(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    try:
        from evaluation.ragas_eval import RagasEvaluator

        evaluator = RagasEvaluator()
        return {"results": evaluator.run(rows)}
    except Exception as exc:
        logger.exception("Evaluation failed")
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {exc}") from exc


@app.post("/cleanup", response_model=NamespaceCleanupResponse)
def cleanup_namespace(payload: NamespaceCleanupRequest) -> NamespaceCleanupResponse:
    try:
        deleted_nodes = _delete_namespace(payload.namespace)
    except Exception as exc:
        logger.exception("Cleanup failed")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {exc}") from exc
    return NamespaceCleanupResponse(namespace=payload.namespace, deleted_nodes=deleted_nodes)


def _build_answer_prompt(question: str, graph_hits: List[Dict], vector_hits: List[Dict]) -> str:
    def format_hits(name: str, hits: List[Dict]) -> str:
        blocks = []
        for item in hits[:8]:
            blocks.append(
                f"[{name}] repo={item['repo']} path={item['path']} symbol={item.get('symbol')} score={item['score']:.3f}\n"
                f"metadata={json.dumps(item.get('metadata', {}))}\n"
                f"code=\n{item['content'][:1800]}"
            )
        return "\n\n".join(blocks)

    return f"""
You are an expert code intelligence assistant. Answer only from the supplied repository evidence.
If evidence is insufficient, say what is missing.
Explain architecture clearly and cite repo/path/symbol references inline.

Question:
{question}

Structural graph evidence:
{format_hits('GRAPH', graph_hits)}

Semantic vector evidence:
{format_hits('VECTOR', vector_hits)}
"""


def _graph_visual(namespace: str | None) -> Dict[str, Any]:
    cypher = """
    MATCH (n)
    WHERE $namespace IS NULL OR n.namespace = $namespace OR n.namespace IS NULL
    OPTIONAL MATCH (n)-[r]->(m)
    WHERE $namespace IS NULL OR m.namespace = $namespace OR m.namespace IS NULL
    RETURN collect(DISTINCT {
        id: elementId(n),
        label: head(labels(n)),
        name: coalesce(n.name, n.path, n.repo, 'node'),
        repo: coalesce(n.repo, n.name, ''),
        path: coalesce(n.path, ''),
        kind: head(labels(n))
    }) AS nodes,
    collect(DISTINCT CASE WHEN r IS NULL THEN NULL ELSE {
        source: elementId(startNode(r)),
        target: elementId(endNode(r)),
        label: type(r)
    } END) AS relationships
    """
    with get_driver().session(database=settings.neo4j_database) as session:
        rec = session.run(cypher, namespace=namespace).single()
        nodes = rec["nodes"] if rec else []
        relationships = [r for r in (rec["relationships"] if rec else []) if r]
        return {
            "nodes": nodes,
            "links": relationships,
            "stats": {"nodes": len(nodes), "relationships": len(relationships)},
        }


def _delete_namespace(namespace: str) -> int:
    cypher = """
    MATCH (n)
    WHERE n.namespace = $namespace
    WITH collect(n) AS nodes
    WITH nodes, size(nodes) AS deleted_nodes
    FOREACH (node IN nodes | DETACH DELETE node)
    RETURN deleted_nodes
    """
    with get_driver().session(database=settings.neo4j_database) as session:
        rec = session.run(cypher, namespace=namespace).single()
        return int(rec["deleted_nodes"] if rec and rec["deleted_nodes"] is not None else 0)


def run_cli_ingest() -> None:
    sample_repos = [repo.strip() for repo in (Path("repos.txt").read_text().splitlines() if Path("repos.txt").exists() else []) if repo.strip()]
    if not sample_repos:
        logger.info("No repos.txt file found. Exiting worker ingestion.")
        return
    payload = RepoIngestRequest(repo_urls=sample_repos)
    ingest_repositories(payload)
    logger.info("Finished worker ingestion")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "ingest":
        run_cli_ingest()
    else:
        import uvicorn

        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
