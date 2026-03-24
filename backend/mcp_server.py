from __future__ import annotations

from typing import Optional

from fastmcp import FastMCP

from retrieval.cypher_retriever import CypherRetriever
from retrieval.vector_retriever import VectorRetriever

mcp = FastMCP("code-intel-graphrag")
vector = VectorRetriever()
graph = CypherRetriever()


@mcp.tool
def graph_search(query: str, namespace: Optional[str] = None, limit: int = 8):
    """Search the code graph for structural matches such as symbols, files, and call edges."""
    return graph.search(query=query, namespace=namespace, limit=limit)


@mcp.tool
def vector_search(query: str, namespace: Optional[str] = None, limit: int = 8):
    """Search code symbol embeddings for semantically similar code blocks."""
    return vector.search(query=query, namespace=namespace, limit=limit)


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=9000)
