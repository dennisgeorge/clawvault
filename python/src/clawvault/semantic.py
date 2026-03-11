"""Optional semantic search providers and scoring."""

from __future__ import annotations

import json
import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol
from urllib import request

from .models import Document


class EmbeddingProvider(Protocol):
    """Protocol for semantic embedding backends."""

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        """Return one embedding vector per input text."""


class SentenceTransformerEmbeddingProvider:
    """Local embedding provider backed by sentence-transformers."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self._model_name = model_name
        self._model: Any | None = None

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise RuntimeError(
                    "sentence-transformers is not installed. "
                    "Install with: pip install 'clawvault-py[semantic]'"
                ) from exc
            self._model = SentenceTransformer(self._model_name)
        vectors = self._model.encode(list(texts))
        return [list(map(float, row)) for row in vectors]


class HTTPEndpointEmbeddingProvider:
    """
    Embedding provider for HTTP APIs.

    Expected response shapes:
      - {"data": [{"embedding": [...]}, ...]}
      - {"embeddings": [[...], ...]}
    """

    def __init__(
        self,
        endpoint: str,
        *,
        api_key: str | None = None,
        model: str | None = None,
        timeout_seconds: int = 30,
    ) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._model = model
        self._timeout_seconds = timeout_seconds

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        payload: dict[str, Any] = {"input": list(texts)}
        if self._model:
            payload["model"] = self._model
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        req = request.Request(self._endpoint, data=body, headers=headers, method="POST")
        with request.urlopen(req, timeout=self._timeout_seconds) as response:
            parsed = json.loads(response.read().decode("utf-8"))

        if isinstance(parsed, dict) and isinstance(parsed.get("embeddings"), list):
            return [list(map(float, row)) for row in parsed["embeddings"]]
        if isinstance(parsed, dict) and isinstance(parsed.get("data"), list):
            rows = []
            for item in parsed["data"]:
                if not isinstance(item, dict) or not isinstance(item.get("embedding"), list):
                    raise RuntimeError("Invalid embedding response payload.")
                rows.append(list(map(float, item["embedding"])))
            return rows
        raise RuntimeError("Could not parse embeddings from response payload.")


@dataclass
class SemanticIndex:
    """Document embedding cache for semantic ranking."""

    provider: EmbeddingProvider
    _doc_ids: list[str] | None = None
    _vectors: list[list[float]] | None = None

    def build(self, documents: Sequence[Document]) -> None:
        texts = [_document_semantic_text(doc) for doc in documents]
        self._doc_ids = [doc.id for doc in documents]
        self._vectors = self.provider.embed(texts)

    def query_scores(self, query: str) -> dict[str, float]:
        if not self._doc_ids or not self._vectors:
            return {}
        query_vector = self.provider.embed([query])[0]
        raw_scores: dict[str, float] = {}
        for doc_id, doc_vector in zip(self._doc_ids, self._vectors):
            raw_scores[doc_id] = max(0.0, cosine_similarity(query_vector, doc_vector))

        max_score = max(raw_scores.values(), default=0.0)
        if max_score <= 0:
            return {doc_id: 0.0 for doc_id in raw_scores}
        return {doc_id: score / max_score for doc_id, score in raw_scores.items()}


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right) or not left:
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return dot / (left_norm * right_norm)


def _document_semantic_text(document: Document) -> str:
    return f"{document.title}\n\n{document.content}"
