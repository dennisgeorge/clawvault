"""Core Vault API for the ClawVault Python SDK."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from .constants import (
    CHECKPOINT_HISTORY_DIRNAME,
    CLAWVAULT_DIRNAME,
    DEFAULT_CATEGORIES,
    DIRTY_DEATH_FLAG_FILENAME,
    LAST_CHECKPOINT_FILENAME,
    MEMORY_TYPE_TO_CATEGORY,
)
from .frontmatter import parse_markdown, serialize_markdown
from .models import CheckpointData, Document, SearchResult
from .search import BM25Searcher, build_snippet, merge_ranked_results, tokenize
from .semantic import EmbeddingProvider, SemanticIndex


class Vault:
    """Python SDK entry point for interacting with a ClawVault vault."""

    def __init__(self, path: str, *, semantic_provider: EmbeddingProvider | None = None) -> None:
        self.path = Path(path).expanduser().resolve()
        self.path.mkdir(parents=True, exist_ok=True)
        self._semantic_provider = semantic_provider

    def store(
        self,
        *,
        category: str,
        title: str,
        content: str,
        frontmatter: dict[str, Any] | None = None,
        overwrite: bool = False,
    ) -> Document:
        """
        Store a markdown memory in the vault.

        File format is kept compatible with the TypeScript ClawVault implementation:
        - filename = slugified title
        - frontmatter includes title/date
        - body is markdown content
        """
        if not category.strip():
            raise ValueError("category must be a non-empty string")
        if not title.strip():
            raise ValueError("title must be a non-empty string")

        slug = _slugify(title) or "note"
        category_path = self.path / category
        category_path.mkdir(parents=True, exist_ok=True)
        file_path = category_path / f"{slug}.md"

        if file_path.exists() and not overwrite:
            relative = file_path.relative_to(self.path).as_posix()
            raise FileExistsError(
                f"Document already exists: {relative}. Use overwrite=True to replace."
            )

        merged_frontmatter: dict[str, Any] = {
            "title": title,
            "date": date.today().isoformat(),
            **(frontmatter or {}),
        }
        markdown = serialize_markdown(content, merged_frontmatter)
        file_path.write_text(markdown, encoding="utf-8")
        return self._load_document(file_path)

    def remember(
        self,
        memory_type: str,
        title: str,
        content: str,
        *,
        frontmatter: dict[str, Any] | None = None,
        overwrite: bool = False,
    ) -> Document:
        """Store a typed memory and route it to the correct category."""
        category = MEMORY_TYPE_TO_CATEGORY.get(memory_type)
        if category is None:
            valid = ", ".join(sorted(MEMORY_TYPE_TO_CATEGORY))
            raise ValueError(f"Unknown memory_type '{memory_type}'. Expected one of: {valid}")

        merged_frontmatter = {**(frontmatter or {}), "memoryType": memory_type}
        return self.store(
            category=category,
            title=title,
            content=content,
            frontmatter=merged_frontmatter,
            overwrite=overwrite,
        )

    def search(
        self,
        query: str,
        *,
        limit: int = 10,
        category: str | None = None,
        semantic: bool = False,
        semantic_weight: float = 0.35,
    ) -> list[SearchResult]:
        """
        Search the vault with BM25, optionally reranked with semantic similarity.

        BM25 is always available via rank_bm25.
        Semantic search is optional and enabled when a provider is configured.
        """
        if not query.strip():
            return []

        docs = self.list_documents(category=category)
        bm25 = BM25Searcher(docs)
        bm25_results = bm25.search(query, limit=limit, category=category)
        if not semantic:
            return bm25_results

        if self._semantic_provider is None:
            raise RuntimeError(
                "semantic=True requested, but no semantic provider is configured. "
                "Pass semantic_provider=... when constructing Vault."
            )

        semantic_index = SemanticIndex(provider=self._semantic_provider)
        semantic_index.build(docs)
        semantic_scores = semantic_index.query_scores(query)

        if bm25_results:
            return merge_ranked_results(
                bm25_results,
                semantic_scores,
                semantic_weight=semantic_weight,
                limit=limit,
            )

        # Semantic-only fallback for queries with no lexical overlap.
        ranked = sorted(semantic_scores.items(), key=lambda item: item[1], reverse=True)[:limit]
        docs_by_id = {doc.id: doc for doc in docs}
        query_terms = tokenize(query)
        results: list[SearchResult] = []
        for doc_id, score in ranked:
            doc = docs_by_id.get(doc_id)
            if doc is None:
                continue
            results.append(
                SearchResult(
                    document=doc,
                    score=score,
                    snippet=build_snippet(doc.content, query_terms),
                    matched_terms=query_terms,
                )
            )
        return results

    def checkpoint(
        self,
        *,
        working_on: str | None = None,
        focus: str | None = None,
        blocked: str | None = None,
        urgent: bool = False,
    ) -> CheckpointData:
        """Persist current session context under `.clawvault/`."""
        timestamp = datetime.now(tz=timezone.utc).isoformat()
        checkpoint = CheckpointData(
            timestamp=timestamp,
            working_on=working_on,
            focus=focus,
            blocked=blocked,
            urgent=urgent,
        )
        clawvault_dir = self.path / CLAWVAULT_DIRNAME
        history_dir = clawvault_dir / CHECKPOINT_HISTORY_DIRNAME
        clawvault_dir.mkdir(parents=True, exist_ok=True)
        history_dir.mkdir(parents=True, exist_ok=True)

        payload = checkpoint.to_dict()
        (clawvault_dir / LAST_CHECKPOINT_FILENAME).write_text(
            json.dumps(payload, indent=2), encoding="utf-8"
        )
        history_name = re.sub(r"[:.]", "-", timestamp) + ".json"
        (history_dir / history_name).write_text(json.dumps(payload, indent=2), encoding="utf-8")
        (clawvault_dir / DIRTY_DEATH_FLAG_FILENAME).write_text(timestamp, encoding="utf-8")
        return checkpoint

    def wake(self, *, handoff_limit: int = 3, brief: bool = True) -> str:
        """
        Build a context markdown string for prompt injection.

        This summarizes checkpoint state and recent high-signal memory categories.
        """
        checkpoint = self._read_checkpoint()
        recent_handoffs = self._recent_handoffs(limit=handoff_limit)
        active_projects = [
            doc
            for doc in self._category_documents("projects")
            if str(doc.frontmatter.get("status", "")).lower() not in {"completed", "archived"}
        ]
        pending_commitments = [
            doc
            for doc in self._category_documents("commitments")
            if str(doc.frontmatter.get("status", "")).lower() != "done"
        ]
        recent_decisions = self._recent_titles("decisions", 3 if brief else 5)
        recent_lessons = self._recent_titles("lessons", 3 if brief else 5)

        lines: list[str] = ["# Wake Context", ""]
        if checkpoint:
            lines.extend(
                [
                    "## Last Checkpoint",
                    f"- Timestamp: {checkpoint.get('timestamp', 'unknown')}",
                    f"- Working on: {checkpoint.get('workingOn') or 'n/a'}",
                    f"- Focus: {checkpoint.get('focus') or 'n/a'}",
                    f"- Blocked: {checkpoint.get('blocked') or 'none'}",
                    "",
                ]
            )

        if recent_handoffs:
            lines.append("## Recent Handoffs")
            for handoff in recent_handoffs:
                lines.append(f"- {handoff}")
            lines.append("")

        if active_projects:
            lines.append("## Active Projects")
            for project in active_projects[:8]:
                lines.append(f"- {project.title}")
            lines.append("")

        if pending_commitments:
            lines.append("## Pending Commitments")
            for commitment in pending_commitments[:8]:
                lines.append(f"- {commitment.title}")
            lines.append("")

        if recent_decisions:
            lines.append("## Recent Decisions")
            for decision in recent_decisions:
                lines.append(f"- {decision}")
            lines.append("")

        if recent_lessons:
            lines.append("## Recent Lessons")
            for lesson in recent_lessons:
                lines.append(f"- {lesson}")
            lines.append("")

        if len(lines) <= 2:
            lines.extend(["_No recent context found in this vault._", ""])
        return "\n".join(lines).rstrip() + "\n"

    def list_documents(self, *, category: str | None = None) -> list[Document]:
        """List markdown documents in the vault."""
        docs = [self._load_document(path) for path in self._iter_markdown_files()]
        if category:
            return [doc for doc in docs if doc.category == category]
        return docs

    @property
    def categories(self) -> list[str]:
        """Default category set used by the TypeScript implementation."""
        return DEFAULT_CATEGORIES.copy()

    def _iter_markdown_files(self) -> list[Path]:
        markdown_files: list[Path] = []
        for file_path in self.path.rglob("*.md"):
            relative_parts = file_path.relative_to(self.path).parts
            if "node_modules" in relative_parts:
                continue
            if any(part.startswith(".") for part in relative_parts):
                continue
            if len(relative_parts) >= 2 and relative_parts[0] == "ledger" and relative_parts[1] == "archive":
                continue
            markdown_files.append(file_path)
        return sorted(markdown_files)

    def _load_document(self, file_path: Path) -> Document:
        markdown = file_path.read_text(encoding="utf-8")
        frontmatter, content = parse_markdown(markdown)
        relative = file_path.relative_to(self.path).as_posix()
        category = relative.split("/", 1)[0] if "/" in relative else "root"
        title = str(frontmatter.get("title") or file_path.stem)
        modified = datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc)
        return Document(
            id=relative[:-3] if relative.endswith(".md") else relative,
            path=file_path,
            category=category,
            title=title,
            content=content,
            frontmatter=frontmatter,
            modified=modified,
        )

    def _read_checkpoint(self) -> dict[str, Any] | None:
        checkpoint_path = self.path / CLAWVAULT_DIRNAME / LAST_CHECKPOINT_FILENAME
        if not checkpoint_path.exists():
            return None
        try:
            parsed = json.loads(checkpoint_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    def _category_documents(self, category: str) -> list[Document]:
        docs = self.list_documents(category=category)
        return sorted(docs, key=lambda item: item.modified, reverse=True)

    def _recent_titles(self, category: str, limit: int) -> list[str]:
        return [doc.title for doc in self._category_documents(category)[:limit]]

    def _recent_handoffs(self, limit: int) -> list[str]:
        docs = self._category_documents("handoffs")[:limit]
        lines: list[str] = []
        for doc in docs:
            working_on = _as_str_list(doc.frontmatter.get("workingOn"))
            next_steps = _as_str_list(doc.frontmatter.get("nextSteps"))
            if working_on or next_steps:
                summary = ", ".join(working_on[:2]) if working_on else doc.title
                if next_steps:
                    summary = f"{summary} -> {next_steps[0]}"
                lines.append(summary)
            else:
                lines.append(doc.title)
        return lines


def _slugify(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def _as_str_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []
