from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from typing import Any, Dict
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import get_settings
from models import AuthStatusResponse, AuthTokenResponse, AuthUser
from user_store import persist_user


GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthActor:
    subject: str
    provider: str
    is_guest: bool = False
    name: str | None = None
    email: str | None = None
    picture: str | None = None

    def to_model(self) -> AuthUser:
        return AuthUser(
            subject=self.subject,
            provider=self.provider,
            is_guest=self.is_guest,
            name=self.name,
            email=self.email,
            picture=self.picture,
        )


def issue_guest_token(name: str | None = None) -> AuthTokenResponse:
    settings = get_settings()
    actor = AuthActor(
        subject=f"guest-{secrets.token_urlsafe(12)}",
        provider="guest",
        is_guest=True,
        name=name or "Guest User",
    )
    expires_in = settings.guest_jwt_expiration_hours * 3600
    token = _encode_jwt(
        {
            "sub": actor.subject,
            "provider": actor.provider,
            "guest": actor.is_guest,
            "name": actor.name,
            "iat": int(time.time()),
            "exp": int(time.time()) + expires_in,
        }
    )
    persist_user(
        subject=actor.subject,
        provider=actor.provider,
        is_guest=actor.is_guest,
        name=actor.name,
        email=actor.email,
        picture=actor.picture,
    )
    return AuthTokenResponse(access_token=token, expires_in=expires_in, user=actor.to_model())


def exchange_google_token(id_token: str) -> AuthTokenResponse:
    settings = get_settings()
    payload = _verify_google_id_token(id_token)
    actor = AuthActor(
        subject=str(payload["sub"]),
        provider="google",
        is_guest=False,
        name=payload.get("name"),
        email=payload.get("email"),
        picture=payload.get("picture"),
    )
    expires_in = settings.jwt_expiration_hours * 3600
    token = _encode_jwt(
        {
            "sub": actor.subject,
            "provider": actor.provider,
            "guest": actor.is_guest,
            "name": actor.name,
            "email": actor.email,
            "picture": actor.picture,
            "iat": int(time.time()),
            "exp": int(time.time()) + expires_in,
        }
    )
    persist_user(
        subject=actor.subject,
        provider=actor.provider,
        is_guest=actor.is_guest,
        name=actor.name,
        email=actor.email,
        picture=actor.picture,
    )
    return AuthTokenResponse(access_token=token, expires_in=expires_in, user=actor.to_model())


def get_optional_auth_actor(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthActor | None:
    if credentials is None:
        return None
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unsupported authorization scheme.")
    payload = _decode_jwt(credentials.credentials)
    return AuthActor(
        subject=str(payload["sub"]),
        provider=str(payload.get("provider") or "app"),
        is_guest=bool(payload.get("guest", False)),
        name=payload.get("name"),
        email=payload.get("email"),
        picture=payload.get("picture"),
    )


def auth_status(actor: AuthActor | None) -> AuthStatusResponse:
    return AuthStatusResponse(authenticated=actor is not None, user=actor.to_model() if actor else None)


def scope_namespace(namespace: str | None, actor: AuthActor | None) -> str:
    base = (namespace or "default").strip() or "default"
    if actor is None:
        return base
    prefix = _namespace_prefix(actor)
    if base.startswith(prefix):
        return base
    return f"{prefix}{base}"


def _namespace_prefix(actor: AuthActor) -> str:
    digest = hashlib.sha256(actor.subject.encode("utf-8")).hexdigest()[:12]
    kind = "guest" if actor.is_guest else actor.provider
    return f"{kind}-{digest}__"


def _verify_google_id_token(id_token: str) -> Dict[str, Any]:
    settings = get_settings()
    url = f"{GOOGLE_TOKENINFO_URL}?{urlencode({'id_token': id_token})}"
    request = Request(url, headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore").strip()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Google token verification failed: {body or exc.reason}") from exc
    except URLError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Google token verification is unavailable: {exc.reason}") from exc

    aud = str(payload.get("aud") or "")
    if settings.google_client_id and aud != settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token audience does not match this app.")
    if payload.get("email_verified") not in ("true", True, "True"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google account email is not verified.")
    if not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token payload did not include a subject.")
    return payload


def _encode_jwt(payload: Dict[str, Any]) -> str:
    settings = get_settings()
    if settings.jwt_algorithm != "HS256":
        raise RuntimeError("Only HS256 JWT signing is currently supported.")
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = f"{_b64url_json(header)}.{_b64url_json(payload)}"
    signature = hmac.new(settings.jwt_secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url(signature)}"


def _decode_jwt(token: str) -> Dict[str, Any]:
    settings = get_settings()
    if settings.jwt_algorithm != "HS256":
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unsupported JWT algorithm configuration.")
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format.") from exc

    signing_input = f"{header_b64}.{payload_b64}"
    expected_signature = hmac.new(settings.jwt_secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    actual_signature = _b64url_decode(signature_b64)
    if not hmac.compare_digest(expected_signature, actual_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature.")

    payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired.")
    if not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token is missing a subject.")
    return payload


def _b64url_json(value: Dict[str, Any]) -> str:
    raw = json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return _b64url(raw)


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
