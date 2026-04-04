from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from tempfile import gettempdir
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_REPO_INDEX_ROOT = str(Path(gettempdir()) / "code-intel-repos")


class Settings(BaseSettings):
    app_name: str = "Code Intelligence GraphRAG"
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    neo4j_uri: str = Field(..., alias="NEO4J_URI")
    neo4j_username: str = Field(..., alias="NEO4J_USERNAME")
    neo4j_password: str = Field(..., alias="NEO4J_PASSWORD")
    neo4j_database: str = Field(default="neo4j", alias="NEO4J_DATABASE")
    neo4j_aura_instance_id: str | None = Field(default=None, alias="NEO4J_AURA_INSTANCE_ID")
    neo4j_aura_client_id: str | None = Field(default=None, alias="NEO4J_AURA_CLIENT_ID")
    neo4j_aura_client_secret: str | None = Field(default=None, alias="NEO4J_AURA_CLIENT_SECRET")
    neo4j_aura_auto_resume: bool = Field(default=True, alias="NEO4J_AURA_AUTO_RESUME")

    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    openai_base_url: str | None = Field(default=None, alias="OPENAI_BASE_URL")
    llm_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    jwt_secret: str = Field(default="change-me-in-production", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expiration_hours: int = Field(default=24, alias="JWT_EXPIRATION_HOURS")
    guest_jwt_expiration_hours: int = Field(default=168, alias="GUEST_JWT_EXPIRATION_HOURS")
    google_client_id: str | None = Field(default=None, alias="GOOGLE_CLIENT_ID")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")

    default_branch: str = "main"
    repo_index_root: str = Field(default=DEFAULT_REPO_INDEX_ROOT, alias="REPO_INDEX_ROOT")
    max_file_bytes: int = 250000
    max_chunk_chars: int = 1800
    chunk_overlap_chars: int = 200
    top_k_vector: int = 8
    top_k_graph: int = 12

    worker_poll_seconds: int = 30
    mcp_http_host: str = "0.0.0.0"
    mcp_http_port: int = 9000

    model_config = SettingsConfigDict(
        env_file=(str(ROOT_DIR / ".env"), str(BACKEND_DIR / ".env")),
        extra="ignore",
        populate_by_name=True,
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
