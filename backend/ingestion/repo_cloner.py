from __future__ import annotations

import os
import shutil
import stat
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from config import get_settings

settings = get_settings()


ALLOWED_SUFFIXES = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
}

IGNORED_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    ".venv",
    "venv",
    "__pycache__",
}


def repo_name_from_url(repo_url: str) -> str:
    path = urlparse(repo_url).path.rstrip("/")
    name = Path(path).name
    return name[:-4] if name.endswith(".git") else name


class RepoCloner:
    def __init__(self, base_dir: str | None = None) -> None:
        self.base_dir = Path(base_dir or settings.repo_index_root)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def clone(self, repo_url: str, ref: str | None = None) -> Path:
        from git import Repo

        repo_name = repo_name_from_url(repo_url)
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        target = self.base_dir / f"{repo_name}-{timestamp}"
        if target.exists():
            shutil.rmtree(target, onerror=_handle_remove_readonly)
        Repo.clone_from(repo_url, target)
        if ref:
            repo = Repo(target)
            repo.git.checkout(ref)
        return target

    def iter_source_files(self, repo_path: Path):
        for path in repo_path.rglob("*"):
            if not path.is_file():
                continue
            if any(part in IGNORED_DIRS for part in path.parts):
                continue
            if path.suffix.lower() in ALLOWED_SUFFIXES and path.stat().st_size <= settings.max_file_bytes:
                yield path


def _handle_remove_readonly(func, path, exc_info) -> None:
    if not os.path.exists(path):
        return
    os.chmod(path, stat.S_IWRITE)
    func(path)
