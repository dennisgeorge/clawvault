---
name: clawvault
version: "2.5.13"
description: Agent memory system with memory graph, context profiles, checkpoint/recover, structured storage, semantic search, and observational memory. Use when: storing/searching memories, preventing context death, graph-aware context retrieval, repairing broken sessions. Don't use when: general file I/O.
author: Versatly
source: https://github.com/Versatly/clawvault
repository: https://github.com/Versatly/clawvault
homepage: https://clawvault.dev
user-invocable: true
openclaw: {"emoji":"🐘","requires":{"bins":["clawvault","qmd"],"env":[]},"install":[{"id":"node","kind":"node","package":"clawvault","bins":["clawvault"],"label":"Install ClawVault CLI (npm)"},{"id":"qmd","kind":"node","package":"github:tobi/qmd","bins":["qmd"],"label":"Install qmd backend (required for query/context workflows)"}],"homepage":"https://clawvault.dev"}
metadata: {"openclaw":{"emoji":"🐘","requires":{"bins":["clawvault","qmd"],"env":[]},"install":[{"id":"node","kind":"node","package":"clawvault","bins":["clawvault"],"label":"Install ClawVault CLI (npm)"},{"id":"qmd","kind":"node","package":"github:tobi/qmd","bins":["qmd"],"label":"Install qmd backend (required for query/context workflows)"}],"homepage":"https://clawvault.dev"}}
---

# ClawVault 🐘

An elephant never forgets. Structured memory for OpenClaw agents.

> **Built for [OpenClaw](https://openclaw.ai)**. Canonical install: npm CLI + hook install + hook enable.

## Security & Transparency

**What this skill does:**
- Reads/writes markdown files in your vault directory (`CLAWVAULT_PATH` or auto-discovered)
- `repair-session` reads and modifies OpenClaw session transcripts (`~/.openclaw/agents/`) — creates backups before writing
- Provides an OpenClaw **hook pack** (`hooks/clawvault/handler.js`) with lifecycle events (`gateway:startup`, `gateway:heartbeat`, `command:new`, `session:start`, `compaction:memoryFlush`, `cron.weekly`). Hook is opt-in and must be installed/enabled.
- `observe --compress` makes LLM API calls (Gemini Flash by default) to compress session transcripts into observations

**Environment variables used:**
- `CLAWVAULT_PATH` — vault location (optional, auto-discovered if not set)
- `OPENCLAW_HOME` / `OPENCLAW_STATE_DIR` — used by `repair-session` to find session transcripts
- `GEMINI_API_KEY` — used by `observe` for LLM compression (optional, only if using observe features)

**No cloud sync — all data stays local. No network calls except LLM API for observe compression.**

**This is a full CLI tool, not instruction-only.** It writes files, registers hooks, and runs code.

**Auditability:** the published ClawHub skill bundle includes `SKILL.md`, `HOOK.md`, and `hooks/clawvault/handler.js` so users can inspect hook behavior before enabling it.

## Install (Canonical)

```bash
npm install -g clawvault
openclaw hooks install clawvault
openclaw hooks enable clawvault

# Verify and reload
openclaw hooks list --verbose
openclaw hooks info clawvault
openclaw hooks check
# restart gateway process
```

`clawhub install clawvault` can install skill guidance, but does not replace explicit hook pack installation.

### Recommended Safe Install Flow

```bash
# 1) Review package metadata before install
npm view clawvault version dist.integrity dist.tarball repository.url

# 2) Install CLI + qmd dependency
npm install -g clawvault@latest
npm install -g github:tobi/qmd

# 3) Install hook pack, but DO NOT enable yet
openclaw hooks install clawvault

# 4) Review hook source locally before enabling
node -e "const fs=require('fs');const p='hooks/clawvault/handler.js';console.log(fs.existsSync(p)?p:'hook file not found in current directory')"
openclaw hooks info clawvault

# 5) Enable only after review
openclaw hooks enable clawvault
openclaw hooks check
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

## Reality Checks Before Use

```bash
# Verify runtime compatibility with current OpenClaw setup
clawvault compat

# Verify qmd is available
qmd --version

# Verify OpenClaw CLI is installed in this shell
openclaw --version
```

ClawVault currently depends on `qmd` for core vault/query flows.

## Workgraph — Multi-Agent Coordination Primitives

ClawVault's workgraph layer enables multiple agents to coordinate through the vault.
Three layers: **Registry** (what types exist), **Ledger** (what happened), **Store** (the files).

### Core Concepts

**Primitives** are typed markdown files with YAML frontmatter. Built-in types: `thread`, `space`, `decision`, `lesson`, `fact`, `agent`. Agents can define new types at runtime.

**Threads** are the unit of coordinated work. They have a lifecycle:
```
open → claim → active → done
                 ↓
              blocked → unblock → active
```

**The Ledger** (`.clawvault/ledger.jsonl`) is the source of truth for coordination:
- Who claimed what, when
- Which threads are available
- Full audit trail of every mutation

**The Registry** (`.clawvault/registry.json`) tracks primitive types:
- 6 built-in types seeded automatically
- Agents create new types at runtime via the API
- Types can be extended with new fields after creation

### Thread Coordination (Programmatic API)

```typescript
import { thread, store, ledger, registry } from './src/workgraph/index.js';

// Create a thread
const t = thread.createThread(vaultPath, 'Build Auth', 'Implement JWT auth', 'my-agent', {
  priority: 'high',
  tags: ['backend'],
});

// Claim it (other agents will see it's taken)
thread.claim(vaultPath, t.path, 'my-agent');

// Check what's available
const open = store.openThreads(vaultPath);
const claims = ledger.allClaims(vaultPath);

// Break big work into smaller threads
thread.decompose(vaultPath, t.path, [
  { title: 'DB Schema', goal: 'Create tables' },
  { title: 'JWT Service', goal: 'Token signing', deps: ['threads/db-schema.md'] },
], 'my-agent');

// Signal completion
thread.done(vaultPath, t.path, 'my-agent', 'Auth system shipped');

// Check audit trail
const history = ledger.historyOf(vaultPath, t.path);
```

### Creating New Primitive Types (Compounding Abstraction)

Agents can define new types at runtime. This is how abstractions compound:

```typescript
import { registry, store } from './src/workgraph/index.js';

// Agent A defines a "workflow" type
registry.defineType(vaultPath, 'workflow', 'A staged work sequence', {
  stages: { type: 'list', required: true },
  current_stage: { type: 'string', default: '' },
}, 'agent-architect');

// Agent B defines a "review-gate" that references workflows
registry.defineType(vaultPath, 'review-gate', 'Approval checkpoint', {
  workflow_ref: { type: 'ref', required: true },
  approver: { type: 'string', required: true },
  approved: { type: 'boolean', default: false },
}, 'agent-pm');

// Any agent can now create instances of these types
store.create(vaultPath, 'workflow', {
  title: 'Deploy Pipeline',
  stages: ['build', 'test', 'staging', 'production'],
}, '# Deploy Pipeline\n\nStandard deployment workflow.', 'agent-ops');
```

### Claim Exclusivity

The ledger prevents race conditions between agents:

```typescript
// Agent A claims a thread
thread.claim(vaultPath, 'threads/auth.md', 'agent-a');

// Agent B tries to claim the same thread — FAILS
thread.claim(vaultPath, 'threads/auth.md', 'agent-b');
// Error: Cannot claim thread in "active" state.

// Agent A releases it
thread.release(vaultPath, 'threads/auth.md', 'agent-a');

// Now Agent B can claim it
thread.claim(vaultPath, 'threads/auth.md', 'agent-b');
```

### Audit Trail

Every mutation is logged to `.clawvault/ledger.jsonl`:

```jsonl
{"ts":"2026-02-26T10:00:00Z","actor":"agent-lead","op":"create","target":"threads/auth.md","type":"thread"}
{"ts":"2026-02-26T10:01:00Z","actor":"agent-worker","op":"claim","target":"threads/auth.md","type":"thread"}
{"ts":"2026-02-26T10:30:00Z","actor":"agent-worker","op":"block","target":"threads/auth.md","type":"thread","data":{"blocked_by":"threads/db.md"}}
{"ts":"2026-02-26T11:00:00Z","actor":"agent-lead","op":"unblock","target":"threads/auth.md","type":"thread"}
{"ts":"2026-02-26T12:00:00Z","actor":"agent-worker","op":"done","target":"threads/auth.md","type":"thread","data":{"output":"JWT auth shipped"}}
```

Query the ledger:
```typescript
ledger.currentOwner(vaultPath, target)    // who owns this?
ledger.isClaimed(vaultPath, target)       // is it taken?
ledger.allClaims(vaultPath)               // all active claims
ledger.historyOf(vaultPath, target)       // full history of a target
ledger.activityOf(vaultPath, actor)       // what has this agent done?
ledger.recent(vaultPath, 20)              // last 20 events
```

### Built-in Primitive Types

| Type | Directory | Purpose |
|------|-----------|---------|
| `thread` | `threads/` | Unit of coordinated work with lifecycle |
| `space` | `spaces/` | Workspace boundary grouping threads |
| `decision` | `decisions/` | Recorded decision with reasoning |
| `lesson` | `lessons/` | Captured insight or pattern |
| `fact` | `facts/` | Structured knowledge (subject-predicate-object) |
| `agent` | `agents/` | Registered participant in the workgraph |

### Best Practices for Multi-Agent Work

1. **One thread per unit of work** — don't overload threads
2. **Decompose big threads** — use `thread.decompose()` to create sub-threads with deps
3. **Always claim before working** — prevents conflicts
4. **Use context_refs** — link threads to relevant decisions/lessons
5. **Release what you can't finish** — let other agents pick it up
6. **Define custom types for repeating patterns** — that's how abstractions compound
7. **Wiki-link between primitives** — `[[threads/auth.md]]` builds the graph

## Current Feature Set

### Memory Graph

ClawVault builds a typed knowledge graph from wiki-links, tags, and frontmatter:

```bash
# View graph summary
clawvault graph

# Refresh graph index
clawvault graph --refresh
```

Graph is stored at `.clawvault/graph-index.json` — schema versioned, incremental rebuild.

### Graph-Aware Context Retrieval

```bash
# Default context (semantic + graph neighbors)
clawvault context "database decision"

# With a profile preset
clawvault context --profile planning "Q1 roadmap"
clawvault context --profile incident "production outage"
clawvault context --profile handoff "session end"

# Auto profile (used by OpenClaw hook)
clawvault context --profile auto "current task"
```

### Context Profiles

| Profile | Purpose |
|---------|---------|
| `default` | Balanced retrieval |
| `planning` | Broader strategic context |
| `incident` | Recent events, blockers, urgent items |
| `handoff` | Session transition context |
| `auto` | Hook-selected profile based on session intent |

### OpenClaw Compatibility Diagnostics

```bash
# Check hook wiring, event routing, handler safety
clawvault compat

# Strict mode for CI
clawvault compat --strict
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

Append this checklist to existing memory instructions. Do not replace your full AGENTS.md behavior unless you intend to.

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

- **qmd not installed** — install qmd, then confirm with `qmd --version`
- **No ClawVault found** — run `clawvault init` or set `CLAWVAULT_PATH`
- **CLAWVAULT_PATH missing** — run `clawvault shell-init` and add to shell rc
- **Too many orphan links** — run `clawvault link --orphans`
- **Inbox backlog warning** — process or archive inbox items
- **"unexpected tool_use_id" error** — run `clawvault repair-session`
- **OpenClaw integration drift** — run `clawvault compat`
- **Hook enable fails / hook not found** — run `openclaw hooks install clawvault`, then `openclaw hooks enable clawvault`, restart gateway, and verify via `openclaw hooks list --verbose`
- **Graph out of date** — run `clawvault graph --refresh`
- **Wrong context for task** — try `clawvault context --profile incident` or `--profile planning`

## Stability Snapshot

- Typecheck passes (`npm run typecheck`)
- Test suite passes (`449/449`)
- Cross-platform path handling hardened for Windows in:
  - qmd URI/document path normalization
  - WebDAV path safety and filesystem resolution
  - shell-init output expectations
- OpenClaw runtime wiring validated by `clawvault compat --strict` (requires local `openclaw` binary for full runtime validation)

## Integration with qmd

ClawVault uses [qmd](https://github.com/tobi/qmd) for search:

```bash
# Install qmd
bun install -g github:tobi/qmd

# Alternative
npm install -g github:tobi/qmd

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
