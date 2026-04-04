from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Iterator

from config import get_settings


logger = logging.getLogger(__name__)
TABLE_NAME = '"Code_intelligence_table"'


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
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
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
