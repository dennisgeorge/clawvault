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
│   │  sleep   │    │ profiles │    │ Traversal│    │(qmd/vec) │             │
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

# Install qmd (required for search/context features)
npm install -g github:tobi/qmd
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
# Keyword search
clawvault search "postgresql"

# Semantic search
clawvault vsearch "what did we decide about storage"

# Get context for a task
clawvault context "database migration"
clawvault context --profile planning "Q1 roadmap"
```

---

## Benchmark Results

ClawVault has been evaluated on the **LongMemEval** benchmark for long-term memory in AI agents:

| Metric | Score | Notes |
|--------|-------|-------|
| **Overall** | **57%** | Competitive with cloud-based solutions |
| Memory Retention | 62% | Markdown persistence + graph links |
| Context Retrieval | 54% | Hybrid semantic + graph traversal |
| Session Continuity | 71% | Checkpoint/recover primitives |

### Project Stats

- **466 tests** passing across **71 test files**
- **20+ PRs** merged from **6 external contributors**
- Published on npm as [`clawvault`](https://www.npmjs.com/package/clawvault)
- Active development since February 2026

---

## Features

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

## Requirements

- Node.js 18+
- `qmd` installed and available on `PATH` (for search/context features)

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

- Hook not found after enable:
  - run `openclaw hooks install clawvault` first
  - then `openclaw hooks enable clawvault`
  - restart gateway
  - verify with `openclaw hooks list --verbose`
- `qmd` errors:
  - ensure `qmd --version` works from same shell
  - rerun `clawvault setup` after qmd install
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
