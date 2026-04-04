from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, HttpUrl


class RepoIngestRequest(BaseModel):
    repo_urls: List[HttpUrl]
    ref: Optional[str] = None
    namespace: Optional[str] = None


class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=3)
    namespace: Optional[str] = None
    max_context_items: int = Field(default=10, ge=1, le=25)


class NamespaceCleanupRequest(BaseModel):
    namespace: str = Field(..., min_length=1)


class NamespaceCleanupResponse(BaseModel):
    namespace: str
    deleted_nodes: int


class RetrievedItem(BaseModel):
    kind: str
    repo: str
    path: str
    symbol: Optional[str] = None
    score: float
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AnswerResponse(BaseModel):
    answer: str
    cypher_context: List[RetrievedItem]
    vector_context: List[RetrievedItem]
    graph: Dict[str, Any] = Field(default_factory=dict)


class GraphSummaryResponse(BaseModel):
    namespace: str
    node_count: int
    relationship_count: int
    repos: List[str]
    sample_nodes: List[Dict[str, Any]]


class AuthUser(BaseModel):
    subject: str
    provider: str
    is_guest: bool = False
    name: Optional[str] = None
    email: Optional[str] = None
    picture: Optional[str] = None


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: Optional[AuthUser] = None


class GuestAuthRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., min_length=20)


class PasswordRegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    name: Optional[str] = Field(default=None, max_length=80)


class PasswordLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)
    password: str = Field(..., min_length=8, max_length=128)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUser
