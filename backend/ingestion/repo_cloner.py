from __future__ import annotations

import os
import shutil
import stat
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from config import get_settings

settings = get_settings()


TEXT_SUFFIXES = {
    ".c",
    ".cc",
    ".cfg",
    ".conf",
    ".cpp",
    ".cs",
    ".css",
    ".csv",
    ".cxx",
    ".dockerfile",
    ".env",
    ".go",
    ".graphql",
    ".h",
    ".hpp",
    ".html",
    ".java",
    ".jl",
    ".js",
    ".json",
    ".jsx",
    ".kt",
    ".kts",
    ".lua",
    ".md",
    ".mdx",
    ".mjs",
    ".php",
    ".py",
    ".r",
    ".rb",
    ".rs",
    ".scala",
    ".scss",
    ".sh",
    ".sql",
    ".swift",
    ".svelte",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".xml",
    ".yaml",
    ".yml",
    ".zsh",
    ".cjs",
}

IGNORED_DIRS = {
    ".git",
    ".github",
    ".gradle",
    ".idea",
    ".next",
    ".nuxt",
    ".pytest_cache",
    ".ruff_cache",
    ".terraform",
    ".tox",
    ".venv",
    ".vscode",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
    "vendor",
    "venv",
}

TEXT_FILE_NAMES = {
    ".dockerignore",
    ".env",
    ".env.example",
    ".eslintrc",
    ".gitignore",
    ".prettierrc",
    "dockerfile",
    "makefile",
    "procfile",
    "readme",
}


def repo_name_from_url(repo_url: str) -> str:
    path = urlparse(_normalize_github_url(repo_url)).path.rstrip("/")
    name = Path(path).name
    return name[:-4] if name.endswith(".git") else name


class RepoCloner:
    def __init__(self, base_dir: str | None = None) -> None:
        self.base_dir = Path(base_dir or settings.repo_index_root)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def clone(self, repo_url: str, ref: str | None = None) -> Path:
        from git import Repo

        clone_url = _normalize_github_url(repo_url)
        repo_name = repo_name_from_url(clone_url)
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        target = self.base_dir / f"{repo_name}-{timestamp}"
        if target.exists():
            shutil.rmtree(target, onerror=_handle_remove_readonly)
        Repo.clone_from(clone_url, target)
        if ref:
            repo = Repo(target)
            repo.git.checkout(ref)
        return target

    def iter_source_files(self, repo_path: Path):
        candidates = []
        for path in repo_path.rglob("*"):
            if path.is_file() and _should_index_file(repo_path, path):
                candidates.append(path)
        yield from sorted(candidates, key=_source_file_sort_key)


def _handle_remove_readonly(func, path, exc_info) -> None:
    if not os.path.exists(path):
        return
    os.chmod(path, stat.S_IWRITE)
    func(path)


def _is_supported_text_file(path: Path) -> bool:
    name = path.name.lower()
    if name in TEXT_FILE_NAMES:
        return True
    if path.suffix.lower() in TEXT_SUFFIXES:
        return True
    return False


def _should_index_file(repo_path: Path, path: Path) -> bool:
    if any(part.lower() in IGNORED_DIRS for part in path.relative_to(repo_path).parts):
        return False
    if path.stat().st_size > settings.max_file_bytes:
        return False
    return _is_supported_text_file(path)


def _source_file_sort_key(path: Path) -> tuple[int, str]:
    suffix = path.suffix.lower()
    lower_name = path.name.lower()
    if suffix in {".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".java", ".rs", ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".hpp"}:
        priority = 0
    elif suffix in {".html", ".css", ".scss", ".vue", ".svelte", ".sql", ".sh"}:
        priority = 1
    elif lower_name in {"readme", "readme.md"} or suffix in {".md", ".mdx", ".txt"}:
        priority = 3
    else:
        priority = 2
    return (priority, str(path).lower())


def _normalize_github_url(repo_url: str) -> str:
    parsed = urlparse(repo_url)
    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        return repo_url

    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2:
        return repo_url

    owner, repo = parts[0], parts[1]
    repo = repo[:-4] if repo.endswith(".git") else repo
    return f"https://github.com/{owner}/{repo}.git"
