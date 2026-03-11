# clawvault-py

Python SDK for reading and writing [ClawVault](https://clawvault.dev) vaults.

This SDK is **file-format compatible** with TypeScript ClawVault vaults:
- Markdown notes stored under category folders
- YAML frontmatter (`title`, `date`, and custom metadata)
- Session checkpoint files under `.clawvault/`

## Installation

```bash
pip install clawvault-py
```

Optional semantic search:

```bash
pip install "clawvault-py[semantic]"
```

## Quickstart

```python
from clawvault import Vault

vault = Vault(path="~/memory")

vault.store(
    category="decisions",
    title="Use Postgres",
    content="We decided to use Postgres for transactional consistency.",
)

results = vault.search("postgres decision")

memory = vault.remember(
    "decision",
    "Use Postgres",
    content="Decision memo with tradeoffs and alternatives.",
)

vault.checkpoint(working_on="migration", focus="schema design")
context = vault.wake()  # context markdown for prompt injection
```

## API

### `Vault(path: str, semantic_provider: EmbeddingProvider | None = None)`

Create or open a vault at `path`.

### `store(category, title, content, frontmatter=None, overwrite=False) -> Document`

Writes markdown to `<vault>/<category>/<slugified-title>.md` with YAML frontmatter.

### `search(query, limit=10, category=None, semantic=False, semantic_weight=0.35) -> list[SearchResult]`

- BM25 search is built in (`rank_bm25`).
- Semantic reranking is available when `semantic=True` and a provider is configured.

### `remember(memory_type, title, content, frontmatter=None, overwrite=False) -> Document`

Routes memory types to canonical categories:
- `decision -> decisions`
- `lesson -> lessons`
- `commitment -> commitments`
- `project -> projects`
- etc.

### `checkpoint(working_on=None, focus=None, blocked=None, urgent=False) -> CheckpointData`

Persists session state to:
- `.clawvault/last-checkpoint.json`
- `.clawvault/checkpoints/<timestamp>.json`
- `.clawvault/dirty-death.flag`

### `wake(handoff_limit=3, brief=True) -> str`

Returns a markdown context summary assembled from:
- last checkpoint
- recent handoffs
- active projects
- pending commitments
- recent decisions and lessons

## Semantic search providers

### Local model (`sentence-transformers`)

```python
from clawvault import SentenceTransformerEmbeddingProvider, Vault

provider = SentenceTransformerEmbeddingProvider("all-MiniLM-L6-v2")
vault = Vault("~/memory", semantic_provider=provider)
results = vault.search("database reliability", semantic=True)
```

### HTTP embeddings API

```python
from clawvault import HTTPEndpointEmbeddingProvider, Vault

provider = HTTPEndpointEmbeddingProvider(
    endpoint="https://your-embeddings-api.example.com/embed",
    api_key="...",
    model="text-embedding-3-small",
)
vault = Vault("~/memory", semantic_provider=provider)
```

## Development

```bash
cd python
pip install -e ".[dev]"
pytest
```
