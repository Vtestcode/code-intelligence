from __future__ import annotations

import base64
import json
import socket
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from neo4j import GraphDatabase

from config import get_settings


AUTH_URL = "https://api.neo4j.io/oauth/token"
API_BASE_URL = "https://api.neo4j.io/v1"


@dataclass
class AuraResumeResult:
    attempted: bool
    resumed: bool
    message: str | None = None


class AuraResumeError(RuntimeError):
    pass


def ensure_neo4j_ready() -> AuraResumeResult:
    settings = get_settings()
    try:
        _ping_database()
        return AuraResumeResult(attempted=False, resumed=False)
    except Exception as exc:
        if not _should_attempt_resume(exc, settings.neo4j_uri):
            raise
        if not settings.neo4j_aura_auto_resume:
            raise AuraResumeError(
                "Neo4j Aura appears paused and auto-resume is disabled. Resume it in Aura Console or set "
                "NEO4J_AURA_AUTO_RESUME=true with Aura API credentials."
            ) from exc
        if not settings.neo4j_aura_client_id or not settings.neo4j_aura_client_secret:
            raise AuraResumeError(
                "Neo4j Aura appears paused. To auto-resume during indexing, set NEO4J_AURA_CLIENT_ID and "
                "NEO4J_AURA_CLIENT_SECRET in .env, or resume the instance manually in Aura Console."
            ) from exc

        instance_id = _instance_id_from_settings()
        if not instance_id:
            raise AuraResumeError(
                "Neo4j Aura auto-resume could not determine the instance ID. Set NEO4J_AURA_INSTANCE_ID in .env."
            ) from exc

        _resume_instance(instance_id, settings.neo4j_aura_client_id, settings.neo4j_aura_client_secret)
        _wait_for_database_ready(timeout_seconds=20)
        return AuraResumeResult(
            attempted=True,
            resumed=True,
            message="Neo4j Aura was paused. The backend sent a resume request and waited for the database to wake up.",
        )


def _ping_database() -> None:
    settings = get_settings()
    with GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password),
    ) as driver:
        driver.verify_connectivity()
        with driver.session(database=settings.neo4j_database) as session:
            session.run("RETURN 1 AS ok").single()


def _should_attempt_resume(exc: Exception, neo4j_uri: str) -> bool:
    message = str(exc).lower()
    host = _host_from_uri(neo4j_uri)
    if "cannot resolve address" in message or "failed to resolve" in message:
        return host is not None and host.endswith(".databases.neo4j.io")
    return "paused" in message


def _instance_id_from_settings() -> str | None:
    settings = get_settings()
    if settings.neo4j_aura_instance_id:
        return settings.neo4j_aura_instance_id.strip()

    host = _host_from_uri(settings.neo4j_uri)
    if not host or not host.endswith(".databases.neo4j.io"):
        return None
    return host.split(".", 1)[0]


def _host_from_uri(uri: str) -> str | None:
    parsed = urlparse(uri)
    return parsed.hostname


def _resume_instance(instance_id: str, client_id: str, client_secret: str) -> None:
    token = _fetch_access_token(client_id, client_secret)
    payload = json.dumps({}).encode("utf-8")
    request = Request(
        f"{API_BASE_URL}/instances/{instance_id}/resume",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            if response.status not in (200, 202, 204):
                raise AuraResumeError(f"Aura resume request returned unexpected status {response.status}.")
    except HTTPError as exc:
        body = _safe_error_body(exc)
        if exc.code == 409:
            return
        raise AuraResumeError(f"Aura resume request failed with {exc.code}. {body}".strip()) from exc
    except URLError as exc:
        raise AuraResumeError(f"Aura resume request could not reach api.neo4j.io: {exc.reason}") from exc


def _fetch_access_token(client_id: str, client_secret: str) -> str:
    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("ascii")
    request = Request(
        AUTH_URL,
        data=b"grant_type=client_credentials",
        method="POST",
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = _safe_error_body(exc)
        raise AuraResumeError(f"Aura token request failed with {exc.code}. {body}".strip()) from exc
    except URLError as exc:
        raise AuraResumeError(f"Aura token request could not reach api.neo4j.io: {exc.reason}") from exc

    access_token = payload.get("access_token")
    if not access_token:
        raise AuraResumeError("Aura token response did not include an access_token.")
    return str(access_token)


def _wait_for_database_ready(timeout_seconds: int) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            _wait_for_dns()
            _ping_database()
            return
        except Exception as exc:
            last_error = exc
            time.sleep(5)
    if last_error:
        raise AuraResumeError(
            "Neo4j Aura resume was requested, but the database is still waking up. "
            f"Retry in about 1-2 minutes. Last error after {timeout_seconds} seconds: {last_error}"
        ) from last_error
    raise AuraResumeError(
        "Neo4j Aura resume was requested, but the database is still waking up. "
        f"Retry in about 1-2 minutes. It was not ready after {timeout_seconds} seconds."
    )


def _wait_for_dns() -> None:
    settings = get_settings()
    host = _host_from_uri(settings.neo4j_uri)
    if not host:
        return
    socket.getaddrinfo(host, 7687)


def _safe_error_body(exc: HTTPError) -> str:
    try:
        body = exc.read().decode("utf-8").strip()
    except Exception:
        return ""
    return body[:300]
