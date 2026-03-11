"""Data models used by the ClawVault Python SDK."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


Frontmatter = dict[str, Any]


@dataclass(frozen=True)
class Document:
    """A markdown memory document stored in a ClawVault vault."""

    id: str
    path: Path
    category: str
    title: str
    content: str
    frontmatter: Frontmatter
    modified: datetime


@dataclass(frozen=True)
class SearchResult:
    """A ranked search hit for a query."""

    document: Document
    score: float
    snippet: str
    matched_terms: list[str]


@dataclass(frozen=True)
class CheckpointData:
    """Session checkpoint payload persisted under .clawvault/."""

    timestamp: str
    working_on: str | None
    focus: str | None
    blocked: str | None
    urgent: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Serialize to TypeScript-compatible checkpoint JSON keys."""
        return {
            "timestamp": self.timestamp,
            "workingOn": self.working_on,
            "focus": self.focus,
            "blocked": self.blocked,
            "urgent": self.urgent,
        }
