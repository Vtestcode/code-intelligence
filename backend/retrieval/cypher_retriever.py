from __future__ import annotations

import re
from typing import Dict, List, Optional

from config import get_settings
from services import get_driver

settings = get_settings()

STOPWORDS = {
    "a",
    "an",
    "and",
    "architecture",
    "code",
    "component",
    "components",
    "controller",
    "controllers",
    "class",
    "classes",
    "define",
    "does",
    "explain",
    "file",
    "files",
    "flow",
    "for",
    "function",
    "functions",
    "how",
    "in",
    "is",
    "it",
    "module",
    "modules",
    "of",
    "path",
    "paths",
    "provide",
    "repo",
    "repository",
    "service",
    "services",
    "storage",
    "system",
    "the",
    "this",
    "through",
    "what",
    "where",
}


class CypherRetriever:
    def __init__(self) -> None:
        self.driver = get_driver()

    def search(self, query: str, namespace: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
        tokens = self._query_tokens(query)
        k = limit or settings.top_k_graph
        cypher = """
        MATCH (r:Repository)-[:CONTAINS]->(f:File)-[:DECLARES]->(s:Symbol)
        WHERE ($namespace IS NULL OR s.namespace = $namespace)
          AND any(token IN $tokens WHERE toLower(s.name) CONTAINS toLower(token)
                                  OR toLower(f.path) CONTAINS toLower(token)
                                  OR toLower(s.content) CONTAINS toLower(token))
        OPTIONAL MATCH (s)-[:CALLS]->(callee)
        RETURN r.name AS repo,
               f.path AS path,
               s.name AS symbol,
               s.symbolType AS symbolType,
               s.content AS content,
               collect(DISTINCT callee.name)[0..10] AS callees,
               size(collect(DISTINCT callee)) AS fanout
        ORDER BY fanout DESC, size(s.content) DESC
        LIMIT $k
        """
        with self.driver.session(database=settings.neo4j_database) as session:
            records = session.run(cypher, tokens=tokens, namespace=namespace, k=k)
            return [
                {
                    "kind": "graph",
                    "repo": r["repo"],
                    "path": r["path"],
                    "symbol": r["symbol"],
                    "score": float(max(0.2, min(1.0, 0.3 + 0.05 * r["fanout"]))),
                    "content": r["content"],
                    "metadata": {
                        "symbol_type": r["symbolType"],
                        "callees": r["callees"],
                    },
                }
                for r in records
            ]

    def overview(self, namespace: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
        k = limit or settings.top_k_graph
        cypher = """
        MATCH (r:Repository)-[:CONTAINS]->(f:File)
        WHERE $namespace IS NULL OR f.namespace = $namespace
        OPTIONAL MATCH (f)-[:DECLARES]->(s:Symbol)
        WITH r, f,
             collect(DISTINCT s.name)[0..12] AS symbols,
             count(DISTINCT s) AS symbol_count
        RETURN r.name AS repo,
               f.path AS path,
               symbol_count,
               symbols,
               left(coalesce(f.content, ''), 2200) AS content
        ORDER BY symbol_count DESC, size(coalesce(f.content, '')) DESC, f.path ASC
        LIMIT $k
        """
        with self.driver.session(database=settings.neo4j_database) as session:
            records = session.run(cypher, namespace=namespace, k=k)
            return [
                {
                    "kind": "overview",
                    "repo": r["repo"],
                    "path": r["path"],
                    "symbol": None,
                    "score": 0.35 + min(0.45, 0.03 * int(r["symbol_count"] or 0)),
                    "content": r["content"],
                    "metadata": {
                        "symbol_count": r["symbol_count"],
                        "symbols": r["symbols"],
                    },
                }
                for r in records
            ]

    def _query_tokens(self, query: str) -> List[str]:
        words = re.findall(r"[A-Za-z0-9_./-]+", query.lower())
        tokens: List[str] = []
        for word in words:
            cleaned = word.strip("`.,:()[]{}'\"")
            if len(cleaned) <= 2 or cleaned in STOPWORDS:
                continue
            tokens.append(cleaned)
        return tokens
