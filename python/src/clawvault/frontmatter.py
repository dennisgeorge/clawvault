"""Utilities for parsing and serializing markdown with YAML frontmatter."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import yaml

from .models import Frontmatter


def parse_markdown(markdown: str) -> tuple[Frontmatter, str]:
    """Parse markdown that may contain `---` YAML frontmatter."""
    if not markdown.startswith("---"):
        return {}, markdown

    lines = markdown.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return {}, markdown

    closing_idx = None
    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            closing_idx = index
            break

    if closing_idx is None:
        return {}, markdown

    yaml_blob = "".join(lines[1:closing_idx]).strip()
    body = "".join(lines[closing_idx + 1 :]).lstrip("\n")
    if not yaml_blob:
        return {}, body

    loaded = yaml.safe_load(yaml_blob)
    if not isinstance(loaded, Mapping):
        raise ValueError("Frontmatter must deserialize to a mapping.")
    return dict(loaded), body


def serialize_markdown(content: str, frontmatter: Mapping[str, Any]) -> str:
    """Render markdown with YAML frontmatter in ClawVault-compatible format."""
    yaml_blob = yaml.safe_dump(
        dict(frontmatter),
        sort_keys=False,
        allow_unicode=False,
        default_flow_style=False,
    ).strip()
    body = content.rstrip()
    if body:
        return f"---\n{yaml_blob}\n---\n\n{body}\n"
    return f"---\n{yaml_blob}\n---\n"
