---
name: clawvault
description: Structured memory vault for AI agents. Store/search memories, track decisions, manage session continuity. Requires qmd for search.
homepage: https://github.com/Versatly/clawvault
metadata: {"clawdbot":{"emoji":"🐘","os":["darwin","linux","win32"],"requires":{"bins":["clawvault","qmd"]},"install":[{"id":"qmd","kind":"shell","command":"bun install -g qmd","bins":["qmd"],"label":"Install qmd (required)"},{"id":"clawvault","kind":"shell","command":"npm install -g clawvault","bins":["clawvault"],"label":"Install clawvault"}]}}
---

# ClawVault 🐘 - Agent Memory System

Structured memory for AI agents. Store, search, and link memories across sessions.

**Requires:** [qmd](https://github.com/Versatly/qmd) for search (local embeddings, no API quotas)

## When to use

- "remember this" / "store this"
- "what do I know about [topic]"
- "search my memories"
- "who is [person]"
- "log this decision"
- "recap" / "what was I working on"
- Before context death → `clawvault handoff`

## Critical: qmd over memory_search

**Always use qmd for memory search, NOT memory_search**

| Tool | Why |
|------|-----|
| `qmd search` | ✅ Local BM25, instant, no limits |
| `qmd vsearch` | ✅ Local embeddings, no API quotas |
| `memory_search` | ❌ Uses Gemini API, hits rate limits |

```bash
# ✅ Do this
qmd search "query" -c your-memory
clawvault search "query"

# ❌ Not this
memory_search  # External API, will hit quotas
```

## Quick reference

### Session continuity

```bash
# On wake
clawvault recap           # Full recap
clawvault recap --brief   # Token-efficient recap

# Before context death
clawvault handoff \
  --working-on "task1, task2" \
  --blocked "blocker" \
  --next "next step" \
  --decisions "key decision made" \
  --feeling "focused"

# Health check
clawvault doctor
```

### Store memories

```bash
clawvault remember decision "Title" --content "..."
clawvault remember lesson "Title" --content "..."
clawvault remember commitment "Title" --content "..."
clawvault capture "Quick note"
```

Types: `decision`, `lesson`, `fact`, `commitment`, `project`, `person`

**Auto-indexed:** All write commands update qmd automatically. Use `--no-index` to skip.

### Search

```bash
clawvault search "query"           # BM25 keyword
clawvault search "query" -c people # Filter by category
clawvault vsearch "query"          # Semantic
```

Or use qmd directly:
```bash
qmd search "query" -c your-memory
qmd vsearch "query" -c your-memory
```

### Browse

```bash
clawvault list                # All
clawvault list decisions      # By category
clawvault get decisions/title # Specific doc
clawvault stats               # Overview
```

## Categories

| Category | Use for |
|----------|---------|
| `decisions` | Choices with reasoning |
| `lessons` | Things learned |
| `people` | One file per person |
| `projects` | Active work |
| `commitments` | Promises and deadlines |
| `inbox` | Quick captures |
| `handoffs` | Session state |

## Setup

```bash
# 1. Install qmd (required)
bun install -g qmd

# 2. Install clawvault
npm install -g clawvault

# 3. Initialize vault
clawvault init ~/memory --qmd-collection my-memory

# 4. Build embeddings
qmd embed
```

## Wiki-links

Use `[[links]]` to connect documents:

```markdown
Related to [[people/pedro]] and [[projects/crm]].
```
