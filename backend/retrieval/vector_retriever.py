from __future__ import annotations

from typing import Dict, List, Optional

from config import get_settings
from services import get_driver, get_embeddings

settings = get_settings()


class VectorRetriever:
    def __init__(self) -> None:
        self.driver = get_driver()
        self.embeddings = get_embeddings()

    def search(self, query: str, namespace: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
        vector = self.embeddings.embed_query(query)
        k = limit or settings.top_k_vector
        cypher = """
        CALL db.index.vector.queryNodes('symbol_embedding', $k, $vector)
        YIELD node, score
        WHERE $namespace IS NULL OR node.namespace = $namespace
        RETURN score,
               node.repo AS repo,
               node.path AS path,
               node.name AS symbol,
               node.content AS content,
               node.symbolType AS symbolType,
               node.startLine AS startLine,
               node.endLine AS endLine
        ORDER BY score DESC
        LIMIT $k
        """
        with self.driver.session(database=settings.neo4j_database) as session:
            records = session.run(cypher, vector=vector, k=k, namespace=namespace)
            return [
                {
                    "kind": "vector",
                    "repo": r["repo"],
                    "path": r["path"],
                    "symbol": r["symbol"],
                    "score": float(r["score"]),
                    "content": r["content"],
                    "metadata": {
                        "symbol_type": r["symbolType"],
                        "start_line": r["startLine"],
                        "end_line": r["endLine"],
                    },
                }
                for r in records
            ]
