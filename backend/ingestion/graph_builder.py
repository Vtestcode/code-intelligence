from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from config import get_settings
from services import get_driver, get_embeddings

settings = get_settings()


class GraphBuilder:
    def __init__(self) -> None:
        self.driver = get_driver()
        self.embeddings = get_embeddings()

    def ensure_schema(self) -> None:
        statements = [
            "CREATE CONSTRAINT repo_name IF NOT EXISTS FOR (r:Repository) REQUIRE (r.name, r.namespace) IS UNIQUE",
            "CREATE CONSTRAINT file_path IF NOT EXISTS FOR (f:File) REQUIRE (f.repo, f.path, f.namespace) IS UNIQUE",
            "CREATE CONSTRAINT symbol_key IF NOT EXISTS FOR (s:Symbol) REQUIRE (s.repo, s.path, s.name, s.namespace) IS UNIQUE",
            f"CREATE VECTOR INDEX symbol_embedding IF NOT EXISTS FOR (s:Symbol) ON (s.embedding) OPTIONS {{indexConfig: {{`vector.dimensions`: {settings.embedding_dimensions}, `vector.similarity_function`: 'cosine'}}}}",
        ]
        with self.driver.session(database=settings.neo4j_database) as session:
            for stmt in statements:
                session.run(stmt)

    def upsert_repository_graph(self, namespace: str, repo_name: str, repo_path: Path, parsed_files: List[Dict]) -> None:
        self.ensure_schema()
        with self.driver.session(database=settings.neo4j_database) as session:
            session.run(
                "MERGE (r:Repository {name: $name, namespace: $namespace}) SET r.lastIndexedAt = datetime(), r.localPath = $local_path",
                name=repo_name,
                namespace=namespace,
                local_path=str(repo_path),
            )
            for parsed in parsed_files:
                rel_path = str(Path(parsed["path"]).relative_to(repo_path))
                session.run(
                    """
                    MATCH (r:Repository {name: $repo_name, namespace: $namespace})
                    MERGE (f:File {repo: $repo_name, path: $path, namespace: $namespace})
                    SET f.language = $language, f.content = $content
                    MERGE (r)-[:CONTAINS]->(f)
                    """,
                    repo_name=repo_name,
                    namespace=namespace,
                    path=rel_path,
                    language=parsed["language"],
                    content=parsed["content"][:20000],
                )
                self._upsert_symbols(session, namespace, repo_name, rel_path, parsed["symbols"])

    def _upsert_symbols(self, session, namespace: str, repo_name: str, rel_path: str, symbols: List[Dict]) -> None:
        texts = [self._symbol_embedding_text(repo_name, rel_path, symbol) for symbol in symbols] or [""]
        vectors = self.embeddings.embed_documents(texts) if symbols else []
        for symbol, embedding in zip(symbols, vectors):
            session.run(
                """
                MATCH (f:File {repo: $repo_name, path: $path, namespace: $namespace})
                MERGE (s:Symbol {repo: $repo_name, path: $path, name: $name, namespace: $namespace})
                SET s.symbolType = $symbol_type,
                    s.startLine = $start_line,
                    s.endLine = $end_line,
                    s.content = $content,
                    s.docstring = $docstring,
                    s.embedding = $embedding
                MERGE (f)-[:DECLARES]->(s)
                """,
                repo_name=repo_name,
                path=rel_path,
                namespace=namespace,
                name=symbol["symbol"],
                symbol_type=symbol["symbol_type"],
                start_line=symbol["start_line"],
                end_line=symbol["end_line"],
                content=symbol["content"][:12000],
                docstring=symbol.get("docstring", ""),
                embedding=embedding,
            )
            for called in symbol.get("calls", []):
                session.run(
                    """
                    MATCH (caller:Symbol {repo: $repo_name, path: $path, name: $name, namespace: $namespace})
                    MERGE (callee:ExternalSymbol {name: $called, namespace: $namespace})
                    MERGE (caller)-[:CALLS]->(callee)
                    """,
                    repo_name=repo_name,
                    path=rel_path,
                    name=symbol["symbol"],
                    called=called,
                    namespace=namespace,
                )

    def _symbol_embedding_text(self, repo_name: str, rel_path: str, symbol: Dict) -> str:
        return (
            f"Repository: {repo_name}\n"
            f"File: {rel_path}\n"
            f"Symbol: {symbol['symbol']}\n"
            f"Type: {symbol['symbol_type']}\n"
            f"Code:\n{symbol['content'][:settings.max_chunk_chars]}"
        )
