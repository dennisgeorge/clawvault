"""Shared constants for the ClawVault Python SDK."""

from __future__ import annotations

from typing import Final

DEFAULT_CATEGORIES: Final[list[str]] = [
    "rules",
    "preferences",
    "decisions",
    "patterns",
    "people",
    "projects",
    "goals",
    "transcripts",
    "inbox",
    "templates",
    "lessons",
    "agents",
    "commitments",
    "handoffs",
    "research",
    "tasks",
    "backlog",
]

MEMORY_TYPE_TO_CATEGORY: Final[dict[str, str]] = {
    "fact": "facts",
    "feeling": "feelings",
    "decision": "decisions",
    "lesson": "lessons",
    "commitment": "commitments",
    "preference": "preferences",
    "relationship": "people",
    "project": "projects",
}

CLAWVAULT_DIRNAME: Final[str] = ".clawvault"
LAST_CHECKPOINT_FILENAME: Final[str] = "last-checkpoint.json"
CHECKPOINT_HISTORY_DIRNAME: Final[str] = "checkpoints"
DIRTY_DEATH_FLAG_FILENAME: Final[str] = "dirty-death.flag"
