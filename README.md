<div align="center">

# ClawVault 🐘

**Persistent Memory for AI Agents**

[![Tests](https://img.shields.io/badge/tests-466%20passing-brightgreen)](https://github.com/Versatly/clawvault)
[![npm](https://img.shields.io/npm/v/clawvault)](https://www.npmjs.com/package/clawvault)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![PRs Merged](https://img.shields.io/badge/PRs%20merged-20%2B-purple)](https://github.com/Versatly/clawvault/pulls?q=is%3Amerged)
[![Contributors](https://img.shields.io/badge/contributors-6-orange)](https://github.com/Versatly/clawvault/graphs/contributors)

*An elephant never forgets. Neither should your AI.*

[Documentation](https://clawvault.dev) · [npm Package](https://www.npmjs.com/package/clawvault) · [Obsidian Plugin](https://clawvault.dev/obsidian) · [GitHub](https://github.com/Versatly/clawvault)

</div>

---

## What is ClawVault?

ClawVault is a **structured memory system** for AI agents that uses **markdown as the storage primitive**. It solves the fundamental problem of AI agents losing context between sessions — what we call "context death."

Unlike vector databases or cloud-based memory solutions, ClawVault is:

- **Local-first** — Your data stays on your machine. No cloud sync, no vendor lock-in.
- **Markdown-native** — Human-readable, git-friendly, works with Obsidian out of the box.
- **Graph-aware** — Wiki-links build a knowledge graph that enriches context retrieval.
- **Session-resilient** — Checkpoint/recover primitives survive crashes and context resets.
- **Fact-aware** — Write-time extraction builds structured facts with conflict resolution.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ClawVault Architecture                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │  Agent   │───▶│  Session │───▶│ Observer │───▶│  Router  │             │
│   │ (Claude, │    │ Watcher  │    │Compressor│    │          │             │
│   │  GPT..)  │    └──────────┘    └──────────┘    └────┬─────┘             │
│   └──────────┘                                         │                    │
│        │                                               ▼                    │
│        │         ┌─────────────────────────────────────────────────────┐   │
│        │         │                  Markdown Vault                      │   │
│        │         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │   │
│        │         │  │decisions/│ │ lessons/ │ │ people/  │ │projects│  │   │
│        │         │  └──────────┘ └──────────┘ └──────────┘ └────────┘  │   │
│        │         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │   │
│        │         │  │ tasks/   │ │ backlog/ │ │handoffs/ │ │ inbox/ │  │   │
│        │         │  └──────────┘ └──────────┘ └──────────┘ └────────┘  │   │
│        │         └─────────────────────────────────────────────────────┘   │
│        │                                    │                               │
│        │         ┌──────────────────────────┴──────────────────────────┐   │
│        │         │              .clawvault/ (Internal State)            │   │
│        │         │  graph-index.json │ last-checkpoint.json │ config   │   │
│        │         └─────────────────────────────────────────────────────┘   │
│        │                                    │                               │
│        ▼                                    ▼                               │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │  wake    │◀──▶│ context  │◀──▶│  Graph   │◀──▶│  Search  │             │
│   │  sleep   │    │ profiles │    │ Traversal│    │(hybrid)  │             │
│   │checkpoint│    └──────────┘    └──────────┘    └──────────┘             │
│   └──────────┘                                                              │
│                                                                             │
│   Data Flow: Session → Observe → Score → Route → Store → Reflect → Promote │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The 8 Primitives

ClawVault is built around 8 core primitives that model how agents should interact with persistent memory:

| Primitive | Description | ClawVault Implementation |
|-----------|-------------|--------------------------|
| **Goals** | What the agent is trying to achieve | `tasks/`, `projects/`, `--working-on` flags |
| **Agents** | Identity and ownership tracking | `--owner` metadata, agent handoffs |
| **State Space** | Current context and environment | `checkpoint`, `recover`, session state |
| **Feedback** | Learning from outcomes | `lessons/`, `observations/`, reflection engine |
| **Capital** | Resources and constraints | Token budgets, context profiles, priority scoring |
| **Institution** | Rules and patterns | `decisions/`, `preferences/`, injection rules |
| **Synthesis** | Combining information | Graph traversal, context blending, semantic search |
| **Recursion** | Self-improvement loops | `reflect`, weekly promotion, archival |

These primitives map directly to CLI commands and vault structure, creating a coherent system for agent memory.

---

## Quick Start

### Installation

```bash
# Install ClawVault CLI
npm install -g clawvault

# Optional: install qmd for backward-compatible fallback paths
npm install -g github:tobi/qmd

# Quick verification
clawvault doctor
```

### Initialize Your Vault

```bash
# Create a new vault
clawvault init ~/memory --name my-brain

# Optional: Set up Obsidian integration
clawvault setup --theme neural --canvas
```

### Basic Workflow

```bash
# Start your session
clawvault wake

# Store memories as you work
clawvault remember decision "Use PostgreSQL" --content "Chosen for JSONB support"
clawvault capture "TODO: Review PR tomorrow"

# Checkpoint during heavy work
clawvault checkpoint --working-on "auth rollout" --focus "token refresh"

# End your session
clawvault sleep "finished auth rollout" --next "implement migration"
```

### Search and Context

```bash
# In-process hybrid search (BM25 + semantic reranking)
clawvault search "postgresql"

# Semantic/vector search commands (requires hosted embeddings configured)
clawvault vsearch "what did we decide about storage"

# Configure hosted embeddings (OpenAI/Gemini/Ollama)
clawvault config set search.embeddings.provider openai
clawvault config set search.embeddings.model text-embedding-3-small
clawvault config set search.embeddings.apiKey "$OPENAI_API_KEY"
clawvault rebuild-embeddings

# Get context for a task
clawvault context "database migration"
clawvault context --profile planning "Q1 roadmap"
```

---

## v3.0 — Structured Memory

ClawVault v3 adds **write-time fact extraction** and **entity graphs** to the core memory pipeline:

- **Fact Store** — Extracts structured facts (preferences, attributes, relationships) at write time with conflict resolution and deduplication
- **Entity Graph** — Builds a relational graph enabling multi-hop queries ("Alice works at Google + Google is in CA → Alice is in CA")
- **Hybrid Search** — BM25 + semantic embeddings + Reciprocal Rank Fusion (RRF)

### Project Stats

- **466 tests** passing across **71 test files**
- **20+ PRs** merged from **6 external contributors**
- Published on npm as [`clawvault`](https://www.npmjs.com/package/clawvault)
- Active development since February 2026

---

## Features

### v3.3 Highlights

- **In-process hybrid search engine** — BM25 + hosted semantic embeddings + cross-encoder reranking, with `qmd` now optional.
- **Python SDK (`clawvault-py`)** — PyPI package with a `Vault` class, BM25 search, and checkpoint/wake lifecycle helpers.
- **Inbox + background workers** — `clawvault inbox add` and `clawvault maintain` with Curator, Janitor, Distiller, and Surveyor workers.

### Memory Graph

ClawVault builds a typed knowledge graph from wiki-links, tags, and frontmatter:

```bash
# View graph summary
clawvault graph

# Refresh graph index
clawvault graph --refresh
```

### Context Profiles

Different tasks need different context. Use profiles to tune retrieval:

| Profile | Purpose |
|---------|---------|
| `default` | Balanced retrieval |
| `planning` | Broader strategic context |
| `incident` | Recent events, blockers, urgent items |
| `handoff` | Session transition context |
| `auto` | Hook-selected based on session intent |

```bash
clawvault context --profile incident "production outage"
```

### Task Management

Full task lifecycle with Kanban support:

```bash
# Create tasks
clawvault task add "Ship v2 onboarding" --owner agent --project core --priority high

# View blocked items
clawvault blocked

# Sync with Obsidian Kanban
clawvault kanban sync
```

### Dynamic Prompt Injection

Pull relevant decisions and preferences into agent context automatically:

```bash
clawvault inject "How should we handle the deployment?"
clawvault inject --enable-llm "What's our pricing strategy?"
```

### Python SDK (clawvault-py)

```bash
pip install clawvault-py
```

```python
from clawvault import Vault

vault = Vault("~/memory")
results = vault.search_bm25("postgresql decision")
vault.checkpoint("working on auth rollout")
```

---

## Obsidian Integration

ClawVault is designed to work seamlessly with Obsidian:

- **Graph themes** — Neural/minimal themes with colored nodes by category
- **Bases views** — Auto-generated task views (`all-tasks.base`, `blocked.base`, `by-project.base`)
- **Canvas dashboards** — `clawvault canvas` generates visual dashboards
- **Kanban round-trip** — Export/import between ClawVault and Obsidian Kanban

```bash
# Generate canvas dashboard
clawvault canvas --template brain

# Set up Obsidian integration
clawvault setup --theme neural --canvas --bases
```

---

## OpenClaw Integration

For hook-based lifecycle integration with OpenClaw:

```bash
# Install and enable hook pack
openclaw hooks install clawvault
openclaw hooks enable clawvault

# Verify
openclaw hooks list --verbose
openclaw hooks check
clawvault compat
```

The hook automatically:
- Detects context death and injects recovery alerts
- Auto-checkpoints before session resets
- Provides `--profile auto` for context queries

### MEMORY.md vs Vault

If you use both a `MEMORY.md` workspace file and a ClawVault vault, understand their roles:

- **MEMORY.md** = Boot context (executive summary the agent sees instantly)
- **Vault** = Full knowledge store (searchable, structured, versioned)

MEMORY.md should contain high-level identity, key decisions, and current focus. The vault stores everything else. Update MEMORY.md periodically to reflect vault state, but it doesn't need to mirror it.

See [docs/openclaw-plugin-usage.md](docs/openclaw-plugin-usage.md) for detailed guidance on this pattern.

---

## System Requirements

- Node.js 18+ (22+ recommended)
- npm 9+
- Linux, macOS, Windows, or WSL
- `qmd` is optional (used only for backward-compatible fallback paths; in-process search is built in)

For Linux-specific install and PATH guidance, see [docs/getting-started/installation.md](docs/getting-started/installation.md).

## LLM Providers

ClawVault supports multiple LLM providers for features like context generation, observation compression, and semantic search. Set the appropriate environment variable to enable a provider:

| Provider | Environment Variable | Default Model | Notes |
|----------|---------------------|---------------|-------|
| **Anthropic** | `ANTHROPIC_API_KEY` | `claude-3-5-haiku-latest` | Claude models |
| **OpenAI** | `OPENAI_API_KEY` | `gpt-4o-mini` | GPT models |
| **Google Gemini** | `GEMINI_API_KEY` | `gemini-2.0-flash` | Gemini models |
| **xAI (Grok)** | `XAI_API_KEY` | `grok-2-latest` | Grok models via OpenAI-compatible API |
| **Ollama** | (local) | `llama3.2` | Local models, no API key needed |
| **OpenAI-compatible** | `OPENAI_API_KEY` | `gpt-4o-mini` | Any OpenAI-compatible endpoint |

Provider priority (when multiple keys are set): OpenClaw > Anthropic > OpenAI > Gemini > xAI

```bash
# Example: Use xAI (Grok) as your LLM provider
export XAI_API_KEY="your-xai-api-key"

# Example: Use Anthropic
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

## Install

```bash
npm install -g clawvault
```

## 5-Minute Setup

```bash
# 1) Create or initialize a vault
clawvault init ~/memory --name my-brain

# 2) Optional vault bootstrap for Obsidian
clawvault setup --theme neural --canvas

# 3) Verify OpenClaw compatibility in this environment
clawvault compat
```

## OpenClaw Setup (Canonical)

If you want hook-based lifecycle integration, use this sequence:

```bash
# Install CLI
npm install -g clawvault

# Install and enable hook pack
openclaw hooks install clawvault
openclaw hooks enable clawvault

# Verify
openclaw hooks list --verbose
openclaw hooks info clawvault
openclaw hooks check
clawvault compat
```

Important:

- `clawhub install clawvault` installs skill guidance, but does not replace hook-pack installation.
- After enabling hooks, restart the OpenClaw gateway process so hook registration reloads.

## Minimal AGENTS.md Additions

Append these to your existing memory workflow. Do not replace your full prompt setup:

```markdown
## ClawVault
- Run `clawvault wake` at session start.
- Run `clawvault checkpoint` during heavy work.
- Run `clawvault sleep "summary" --next "next steps"` before ending.
- Use `clawvault context "<task>"` or `clawvault inject "<message>"` before complex decisions.
```

---

## CLI Reference

### Core Commands

- `init`, `setup`, `store`, `capture`
- `remember`, `list`, `get`, `stats`, `reindex`, `sync`

### Context + Memory

- `search`, `vsearch`, `context`, `inject`
- `observe`, `reflect`, `session-recap`
- `graph`, `entities`, `link`, `embed`

### Resilience

- `wake`, `sleep`, `handoff`, `recap`
- `checkpoint`, `recover`, `status`, `clean-exit`, `repair-session`
- `compat`, `doctor`

### Execution Primitives

- `task ...`, `backlog ...`, `blocked`, `project ...`, `kanban ...`
- `canvas` (generates default `dashboard.canvas`)

### Networking

- `tailscale-status`, `tailscale-sync`, `tailscale-serve`, `tailscale-discover`

---

## Quick Usage Examples

```bash
# Store and retrieve memory
clawvault remember decision "Use PostgreSQL" --content "Chosen for JSONB and reliability"
clawvault search "postgresql"
clawvault vsearch "what did we decide about storage"

# Session lifecycle
clawvault wake
clawvault checkpoint --working-on "auth rollout" --focus "token refresh edge cases"
clawvault sleep "finished auth rollout plan" --next "implement migration"

# Work management
clawvault task add "Ship v2 onboarding" --owner agent --project core --priority high
clawvault blocked
clawvault project list --status active
clawvault kanban sync

# Obsidian projection
clawvault canvas
```

---

## Tailscale + WebDAV

ClawVault can serve vault content for sync over Tailscale and exposes WebDAV under `/webdav` for mobile-oriented workflows.

```bash
clawvault tailscale-status
clawvault tailscale-serve --vault ~/memory
clawvault tailscale-discover
```

---

## Vault Structure

```
vault/
├── .clawvault/           # Internal state
│   ├── graph-index.json  # Knowledge graph
│   ├── last-checkpoint.json
│   └── config.json
├── decisions/            # Key choices with reasoning
├── lessons/              # Insights and patterns
├── people/               # One file per person
├── projects/             # Active work tracking
├── tasks/                # Task files with frontmatter
├── backlog/              # Quick captures and ideas
├── handoffs/             # Session continuity
├── inbox/                # Quick captures
└── templates/            # Document templates
```

---

## Troubleshooting

- First-line diagnostic:
  - run `clawvault doctor` after install or environment changes
- Global install fails with `EACCES` / permission denied:
  - run `npm config set prefix ~/.npm-global`
  - add `export PATH="$HOME/.npm-global/bin:$PATH"` to your shell rc and reload shell
- `clawvault: command not found` after install:
  - check `npm config get prefix`
  - ensure `<prefix>/bin` is present in your `PATH`
- `qmd` fallback errors:
  - `qmd` is optional; in-process BM25 search is available without it
  - if you want fallback compatibility, ensure `qmd --version` works in the same shell
- Hook/plugin not active in OpenClaw:
  - run `openclaw hooks install clawvault`
  - run `openclaw hooks enable clawvault`
  - verify with `openclaw hooks list --verbose`
- OpenClaw integration drift:
  - run `clawvault compat`
- Session transcript corruption:
  - run `clawvault repair-session --dry-run` then `clawvault repair-session`

---

## Links

| Resource | URL |
|----------|-----|
| **Documentation** | [clawvault.dev](https://clawvault.dev) |
| **npm Package** | [npmjs.com/package/clawvault](https://www.npmjs.com/package/clawvault) |
| **GitHub** | [github.com/Versatly/clawvault](https://github.com/Versatly/clawvault) |
| **Issues** | [github.com/Versatly/clawvault/issues](https://github.com/Versatly/clawvault/issues) |
| **Obsidian Plugin** | [clawvault.dev/obsidian](https://clawvault.dev/obsidian) |

---

## Contributing

We welcome contributions! ClawVault has had **20+ PRs merged** from **6 external contributors**.

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm test`
4. Submit a PR

See our [contribution guidelines](https://github.com/Versatly/clawvault/blob/main/CONTRIBUTING.md) for details.

---

**$CLAW**: [`5Fjr82MTB8mvxkzi9FYtvrUsPiDGE2M29w3dYcZpump`](https://pump.fun/coin/5Fjr82MTB8mvxkzi9FYtvrUsPiDGE2M29w3dYcZpump)

## License

MIT
