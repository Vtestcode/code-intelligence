from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from contextlib import contextmanager
from typing import Iterator

from fastapi import HTTPException, status

from config import get_settings


logger = logging.getLogger(__name__)
TABLE_NAME = '"Code_intelligence_table"'


def register_password_user(*, email: str, password: str, name: str | None) -> dict:
    settings = get_settings()
    if not settings.database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password sign-in requires DATABASE_URL to be configured.",
        )

    normalized_email = email.strip().lower()
    password_hash = _hash_password(password)
    subject = f"password-{normalized_email}"

    try:
        with _connection() as conn:
            with conn.cursor() as cur:
                _ensure_table(cur)
                cur.execute(
                    f"SELECT subject FROM {TABLE_NAME} WHERE email = %s",
                    (normalized_email,),
                )
                if cur.fetchone():
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with that email already exists.")

                cur.execute(
                    f"""
                    INSERT INTO {TABLE_NAME} (
                        subject,
                        provider,
                        is_guest,
                        name,
                        email,
                        picture,
                        password_hash,
                        last_login_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                    RETURNING subject, provider, is_guest, name, email, picture
                    """,
                    (subject, "password", False, name, normalized_email, None, password_hash),
                )
                row = cur.fetchone()
            conn.commit()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to register password user")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create the account.") from exc

    return _row_to_user_dict(row)


def authenticate_password_user(*, email: str, password: str) -> dict:
    settings = get_settings()
    if not settings.database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password sign-in requires DATABASE_URL to be configured.",
        )

    normalized_email = email.strip().lower()
    try:
        with _connection() as conn:
            with conn.cursor() as cur:
                _ensure_table(cur)
                cur.execute(
                    f"""
                    SELECT subject, provider, is_guest, name, email, picture, password_hash
                    FROM {TABLE_NAME}
                    WHERE email = %s
                    """,
                    (normalized_email,),
                )
                row = cur.fetchone()
                if not row or not row[6]:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
                if not _verify_password(password, row[6]):
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

                cur.execute(
                    f"UPDATE {TABLE_NAME} SET last_login_at = NOW(), updated_at = NOW() WHERE subject = %s",
                    (row[0],),
                )
            conn.commit()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to authenticate password user")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to sign in right now.") from exc

    return {
        "subject": row[0],
        "provider": row[1],
        "is_guest": row[2],
        "name": row[3],
        "email": row[4],
        "picture": row[5],
    }


def persist_user(
    *,
    subject: str,
    provider: str,
    is_guest: bool,
    name: str | None,
    email: str | None,
    picture: str | None,
) -> None:
    settings = get_settings()
    if not settings.database_url:
        return

    try:
        with _connection() as conn:
            with conn.cursor() as cur:
                _ensure_table(cur)
                cur.execute(
                    f"""
                    INSERT INTO {TABLE_NAME} (
                        subject,
                        provider,
                        is_guest,
                        name,
                        email,
                        picture,
                        last_login_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (subject) DO UPDATE
                    SET provider = EXCLUDED.provider,
                        is_guest = EXCLUDED.is_guest,
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        picture = EXCLUDED.picture,
                        updated_at = NOW(),
                        last_login_at = NOW()
                    """,
                    (subject, provider, is_guest, name, email, picture),
                )
            conn.commit()
    except Exception:
        logger.exception("Failed to persist auth user to Postgres table %s", TABLE_NAME)


@contextmanager
def _connection() -> Iterator[object]:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured.")

    import psycopg2

    conn = psycopg2.connect(settings.database_url)
    try:
        yield conn
    finally:
        conn.close()


def _ensure_table(cur) -> None:
    cur.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
            id BIGSERIAL PRIMARY KEY,
            subject TEXT NOT NULL UNIQUE,
            provider TEXT NOT NULL,
            is_guest BOOLEAN NOT NULL DEFAULT FALSE,
            name TEXT NULL,
            email TEXT NULL,
            picture TEXT NULL,
            password_hash TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    cur.execute(f"ALTER TABLE {TABLE_NAME} ADD COLUMN IF NOT EXISTS password_hash TEXT NULL")
    cur.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS code_intel_subject_idx ON {TABLE_NAME} (subject)")
    cur.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS code_intel_email_idx ON {TABLE_NAME} (email) WHERE email IS NOT NULL")


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return f"pbkdf2_sha256$200000${_b64(salt)}${_b64(derived)}"


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_raw, salt_raw, digest_raw = stored_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    try:
        iterations = int(iterations_raw)
    except ValueError:
        return False
    salt = _b64decode(salt_raw)
    expected = _b64decode(digest_raw)
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return secrets.compare_digest(actual, expected)


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _row_to_user_dict(row) -> dict:
    return {
        "subject": row[0],
        "provider": row[1],
        "is_guest": row[2],
        "name": row[3],
        "email": row[4],
        "picture": row[5],
    }
