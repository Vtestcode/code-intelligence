from __future__ import annotations

from typing import List

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from neo4j import GraphDatabase

from config import get_settings


_settings = get_settings()


def get_driver():
    return GraphDatabase.driver(
        _settings.neo4j_uri,
        auth=(_settings.neo4j_username, _settings.neo4j_password),
    )


def _openai_client_kwargs() -> dict:
    kwargs = {"api_key": _settings.openai_api_key}
    if _settings.openai_base_url:
        kwargs["base_url"] = _settings.openai_base_url
    return kwargs


def get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=_settings.llm_model,
        **_openai_client_kwargs(),
        temperature=0.1,
        max_tokens=1200,
    )


def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=_settings.embedding_model,
        **_openai_client_kwargs(),
        dimensions=_settings.embedding_dimensions,
    )


def cosine_similarity(a: List[float], b: List[float]) -> float:
    import math

    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
