"""BM25 search utilities for ClawVault vaults."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from rank_bm25 import BM25Okapi

from .models import Document, SearchResult

TOKEN_RE = re.compile(r"\b\w+\b", flags=re.UNICODE)


def tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase BM25 terms."""
    return TOKEN_RE.findall(text.lower())


def build_snippet(content: str, query_terms: list[str], max_len: int = 180) -> str:
    """Extract a compact snippet around the first matching term."""
    if not content.strip():
        return ""
    lowered = content.lower()
    index = -1
    for term in query_terms:
        index = lowered.find(term)
        if index >= 0:
            break
    if index < 0:
        index = 0

    start = max(0, index - (max_len // 2))
    end = min(len(content), start + max_len)
    snippet = content[start:end].strip()
    if start > 0:
        snippet = f"...{snippet}"
    if end < len(content):
        snippet = f"{snippet}..."
    return snippet


@dataclass(frozen=True)
class _ScoredDoc:
    document: Document
    score: float


class BM25Searcher:
    """In-memory BM25 search over vault documents."""

    def __init__(self, documents: Iterable[Document]) -> None:
        self._documents: list[Document] = list(documents)
        self._corpus_tokens: list[list[str]] = [
            tokenize(_document_to_index_text(doc)) for doc in self._documents
        ]
        self._bm25 = BM25Okapi(self._corpus_tokens) if self._corpus_tokens else None

    def search(
        self, query: str, *, limit: int = 10, category: str | None = None
    ) -> list[SearchResult]:
        terms = tokenize(query)
        if not terms or self._bm25 is None:
            return []

        raw_scores = self._bm25.get_scores(terms)
        scored_pairs: list[tuple[Document, float]] = []
        for idx, score in enumerate(raw_scores):
            doc = self._documents[idx]
            if category and doc.category != category:
                continue
            doc_tokens = set(self._corpus_tokens[idx])
            if not doc_tokens.intersection(terms):
                continue
            scored_pairs.append((doc, float(score)))

        if not scored_pairs:
            return []

        min_score = min(score for _, score in scored_pairs)
        max_score = max(score for _, score in scored_pairs)
        scored: list[_ScoredDoc] = []
        for doc, score in scored_pairs:
            if max_score == min_score:
                normalized = 1.0
            else:
                normalized = (score - min_score) / (max_score - min_score)
            scored.append(_ScoredDoc(document=doc, score=normalized))

        scored.sort(key=lambda item: item.score, reverse=True)
        results: list[SearchResult] = []
        for item in scored[:limit]:
            results.append(
                SearchResult(
                    document=item.document,
                    score=item.score,
                    snippet=build_snippet(item.document.content, terms),
                    matched_terms=terms,
                )
            )
        return results


def merge_ranked_results(
    bm25_results: list[SearchResult],
    semantic_scores: dict[str, float],
    *,
    semantic_weight: float,
    limit: int,
) -> list[SearchResult]:
    """Fuse BM25 + semantic scores by weighted sum."""
    clipped_weight = min(max(semantic_weight, 0.0), 1.0)
    combined: list[SearchResult] = []
    for result in bm25_results:
        doc_id = result.document.id
        semantic_score = semantic_scores.get(doc_id, 0.0)
        score = ((1.0 - clipped_weight) * result.score) + (clipped_weight * semantic_score)
        combined.append(
            SearchResult(
                document=result.document,
                score=score,
                snippet=result.snippet,
                matched_terms=result.matched_terms,
            )
        )

    combined.sort(key=lambda item: item.score, reverse=True)
    return combined[:limit]


def _document_to_index_text(document: Document) -> str:
    tags = document.frontmatter.get("tags")
    tag_text = " ".join(tags) if isinstance(tags, list) else ""
    return "\n".join([document.title, tag_text, document.content])
