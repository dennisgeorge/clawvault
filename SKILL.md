---
name: clawvault
version: 1.11.2
description: Agent memory system with checkpoint/recover, structured storage, semantic search, session transcript repair, and optional cloud sync. Use when: storing/searching memories, preventing context death, repairing broken sessions. Don't use when: general file I/O.
author: Versatly
repository: https://github.com/Versatly/clawvault
homepage: https://clawvault.dev
metadata: {"openclaw":{"emoji":"🐘","requires":{"bins":["clawvault"]},"install":[{"id":"node","kind":"node","package":"clawvault","bins":["clawvault"],"label":"Install ClawVault CLI (npm)"}]}}
---

# ClawVault 🐘

An elephant never forgets. Structured memory for OpenClaw agents.

> **Built for [OpenClaw](https://openclaw.ai)** — install via `clawhub install clawvault`

## Security & Transparency

**What this skill does:**
- Reads/writes markdown files in your vault directory (`CLAWVAULT_PATH` or auto-discovered)
- `repair-session` reads and modifies OpenClaw session transcripts (`~/.openclaw/agents/`) — creates backups before writing
- Installs an OpenClaw **hook** (`hooks/clawvault/handler.js`) that runs on `gateway:startup` and `command:new` events to auto-checkpoint and detect context death. The hook is **opt-in** — enable via `openclaw hooks enable clawvault`
- `observe --compress` makes LLM API calls (Gemini Flash by default) to compress session transcripts into observations

**Environment variables used:**
- `CLAWVAULT_PATH` — vault location (optional, auto-discovered if not set)
- `OPENCLAW_HOME` / `OPENCLAW_STATE_DIR` — used by `repair-session` to find session transcripts
- `GEMINI_API_KEY` — used by `observe` for LLM compression (optional, only if using observe features)

**No cloud sync — all data stays local. No network calls except LLM API for observe compression.**

**This is a full CLI tool, not instruction-only.** It writes files, registers hooks, and runs code.

## Install

```bash
npm install -g clawvault
```

## Setup

```bash
# Initialize vault (creates folder structure + templates)
clawvault init ~/my-vault

# Or set env var to use existing vault
export CLAWVAULT_PATH=/path/to/memory

# Optional: shell integration (aliases + CLAWVAULT_PATH)
clawvault shell-init >> ~/.bashrc
```

## Quick Start for New Agents

```bash
# Start your session (recover + recap + summary)
clawvault wake

# Capture and checkpoint during work
clawvault capture "TODO: Review PR tomorrow"
clawvault checkpoint --working-on "PR review" --focus "type guards"

# End your session with a handoff
clawvault sleep "PR review + type guards" --next "respond to CI" --blocked "waiting for CI"

# Health check when something feels off
clawvault doctor
```

## Core Commands

### Wake + Sleep (primary)

```bash
clawvault wake
clawvault sleep "what I was working on" --next "ship v1" --blocked "waiting for API key"
```

### Store memories by type

```bash
# Types: fact, feeling, decision, lesson, commitment, preference, relationship, project
clawvault remember decision "Use Postgres over SQLite" --content "Need concurrent writes for multi-agent setup"
clawvault remember lesson "Context death is survivable" --content "Checkpoint before heavy work"
clawvault remember relationship "Justin Dukes" --content "Client contact at Hale Pet Door"
```

### Quick capture to inbox

```bash
clawvault capture "TODO: Review PR tomorrow"
```

### Search (requires qmd installed)

```bash
# Keyword search (fast)
clawvault search "client contacts"

# Semantic search (slower, more accurate)
clawvault vsearch "what did we decide about the database"
```

## Context Death Resilience

### Wake (start of session)

```bash
clawvault wake
```

### Sleep (end of session)

```bash
clawvault sleep "what I was working on" --next "finish docs" --blocked "waiting for review"
```

### Checkpoint (save state frequently)

```bash
clawvault checkpoint --working-on "PR review" --focus "type guards" --blocked "waiting for CI"
```

### Recover (manual check)

```bash
clawvault recover --clear
# Shows: death time, last checkpoint, recent handoff
```

### Handoff (manual session end)

```bash
clawvault handoff \
  --working-on "ClawVault improvements" \
  --blocked "npm token" \
  --next "publish to npm, create skill" \
  --feeling "productive"
```

### Recap (bootstrap new session)

```bash
clawvault recap
# Shows: recent handoffs, active projects, pending commitments, lessons
```

## Auto-linking

Wiki-link entity mentions in markdown files:

```bash
# Link all files
clawvault link --all

# Link single file
clawvault link memory/2024-01-15.md
```

## Folder Structure

```
vault/
├── .clawvault/           # Internal state
│   ├── last-checkpoint.json
│   └── dirty-death.flag
├── decisions/            # Key choices with reasoning
├── lessons/              # Insights and patterns
├── people/               # One file per person
├── projects/             # Active work tracking
├── handoffs/             # Session continuity
├── inbox/                # Quick captures
└── templates/            # Document templates
```

## Best Practices

1. **Wake at session start** — `clawvault wake` restores context
2. **Checkpoint every 10-15 min** during heavy work
3. **Sleep before session end** — `clawvault sleep` captures next steps
4. **Use types** — knowing WHAT you're storing helps WHERE to put it
5. **Wiki-link liberally** — `[[person-name]]` builds your knowledge graph

## Checklist for AGENTS.md

```markdown
## Memory Checklist
- [ ] Run `clawvault wake` at session start
- [ ] Checkpoint during heavy work
- [ ] Capture key decisions/lessons with `clawvault remember`
- [ ] Use wiki-links like `[[person-name]]`
- [ ] End with `clawvault sleep "..." --next "..." --blocked "..."`
- [ ] Run `clawvault doctor` when something feels off
```

## Session Transcript Repair (v1.5.0+)

When the Anthropic API rejects with "unexpected tool_use_id found in tool_result blocks", use:

```bash
# See what's wrong (dry-run)
clawvault repair-session --dry-run

# Fix it
clawvault repair-session

# Repair a specific session
clawvault repair-session --session <id> --agent <agent-id>

# List available sessions
clawvault repair-session --list
```

**What it fixes:**
- Orphaned `tool_result` blocks referencing non-existent `tool_use` IDs
- Aborted tool calls with partial JSON
- Broken parent chain references

Backups are created automatically (use `--no-backup` to skip).

## Troubleshooting

- **qmd not installed** — run `bun install -g github:tobi/qmd` or `npm install -g qmd`
- **No ClawVault found** — run `clawvault init` or set `CLAWVAULT_PATH`
- **CLAWVAULT_PATH missing** — run `clawvault shell-init` and add to shell rc
- **Too many orphan links** — run `clawvault link --orphans`
- **Inbox backlog warning** — process or archive inbox items
- **"unexpected tool_use_id" error** — run `clawvault repair-session`
- **OpenClaw integration drift** — run `clawvault compat`

## Integration with qmd

ClawVault uses [qmd](https://github.com/tobi/qmd) for search:

```bash
# Install qmd
bun install -g github:tobi/qmd

# Add vault as collection
qmd collection add /path/to/vault --name my-memory --mask "**/*.md"

# Update index
qmd update && qmd embed
```

## Environment Variables

- `CLAWVAULT_PATH` — Default vault path (skips auto-discovery)
- `OPENCLAW_HOME` — OpenClaw home directory (used by repair-session)
- `OPENCLAW_STATE_DIR` — OpenClaw state directory (used by repair-session)
- `GEMINI_API_KEY` — Used by `observe` for LLM-powered compression (optional)

## Links

- npm: https://www.npmjs.com/package/clawvault
- GitHub: https://github.com/Versatly/clawvault
- Issues: https://github.com/Versatly/clawvault/issues
