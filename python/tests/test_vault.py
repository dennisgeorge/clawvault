from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from clawvault import Vault


@pytest.fixture()
def vault(tmp_path: Path) -> Vault:
    return Vault(path=str(tmp_path / "memory"))


def test_store_writes_clawvault_compatible_markdown(vault: Vault) -> None:
    document = vault.store(
        category="decisions",
        title="Use Postgres",
        content="We decided to use Postgres for transactional integrity.",
        frontmatter={"tags": ["db", "architecture"], "type": "decision"},
    )

    expected_file = vault.path / "decisions" / "use-postgres.md"
    assert expected_file.exists()
    assert document.path == expected_file
    assert document.category == "decisions"
    assert document.frontmatter["title"] == "Use Postgres"
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(document.frontmatter["date"]))
    raw = expected_file.read_text(encoding="utf-8")
    assert raw.startswith("---\n")
    assert "title: Use Postgres" in raw
    assert "We decided to use Postgres" in raw


def test_search_uses_bm25_ranking(vault: Vault) -> None:
    vault.store(
        category="decisions",
        title="Use Postgres",
        content="Postgres gives us reliable transactions and strong consistency.",
    )
    vault.store(
        category="projects",
        title="Frontend polish",
        content="Polish forms, spacing, and typography in dashboard widgets.",
    )

    results = vault.search("postgres transactions", limit=5)
    assert results
    assert results[0].document.title == "Use Postgres"
    assert results[0].score > 0


def test_remember_routes_memory_type_to_category(vault: Vault) -> None:
    memory = vault.remember(
        "decision",
        "Adopt Postgres",
        content="Decision memo with rationale and migration tradeoffs.",
    )
    assert memory.category == "decisions"
    assert memory.frontmatter["memoryType"] == "decision"
    assert memory.path == vault.path / "decisions" / "adopt-postgres.md"


def test_checkpoint_persists_state_and_history(vault: Vault) -> None:
    checkpoint = vault.checkpoint(
        working_on="migration",
        focus="schema design",
        blocked="need approval",
    )
    clawvault_dir = vault.path / ".clawvault"
    checkpoint_path = clawvault_dir / "last-checkpoint.json"
    dirty_flag_path = clawvault_dir / "dirty-death.flag"
    history_dir = clawvault_dir / "checkpoints"

    assert checkpoint_path.exists()
    assert dirty_flag_path.exists()
    assert history_dir.exists()

    payload = json.loads(checkpoint_path.read_text(encoding="utf-8"))
    assert payload["workingOn"] == "migration"
    assert payload["focus"] == "schema design"
    assert payload["blocked"] == "need approval"
    assert payload["timestamp"] == checkpoint.timestamp
    assert list(history_dir.glob("*.json"))


def test_wake_returns_injection_ready_context(vault: Vault) -> None:
    vault.checkpoint(working_on="migration", focus="schema design")
    vault.store(
        category="handoffs",
        title="handoff-2026-03-11-1010",
        content="Session handoff notes",
        frontmatter={
            "type": "handoff",
            "workingOn": ["migration", "schema mapping"],
            "nextSteps": ["finalize migration plan"],
        },
    )
    vault.store(category="projects", title="Core API Migration", content="In progress")
    vault.store(
        category="commitments",
        title="Ship migration RFC",
        content="Must finish this week",
        frontmatter={"status": "in-progress"},
    )
    vault.store(category="decisions", title="Use Postgres", content="Decision details")
    vault.store(category="lessons", title="Keep migrations reversible", content="Lesson details")

    context = vault.wake()
    assert "## Last Checkpoint" in context
    assert "migration" in context
    assert "## Recent Handoffs" in context
    assert "finalize migration plan" in context
    assert "## Active Projects" in context
    assert "Core API Migration" in context
    assert "## Recent Decisions" in context
    assert "Use Postgres" in context
