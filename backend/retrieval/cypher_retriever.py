from __future__ import annotations

from typing import Dict, List, Optional

from config import get_settings
from services import get_driver

settings = get_settings()


class CypherRetriever:
    def __init__(self) -> None:
        self.driver = get_driver()

    def search(self, query: str, namespace: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
        tokens = [t.strip("`.,:()[]{}") for t in query.split() if len(t) > 2]
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
