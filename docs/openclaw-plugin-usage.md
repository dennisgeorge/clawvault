# OpenClaw Plugin Usage Guide

This guide covers best practices for using ClawVault as an OpenClaw plugin, including configuration, workflow patterns, and common integration scenarios.

## Installation

See the [README](../README.md#openclaw-integration) for canonical installation steps:

```bash
npm install -g clawvault
openclaw hooks install clawvault
openclaw hooks enable clawvault
```

## MEMORY.md vs Vault: Understanding the Relationship

When using ClawVault as an OpenClaw plugin, you may have both a `MEMORY.md` file in your workspace and a ClawVault vault. Understanding their distinct roles prevents confusion and drift.

### The Two Memory Layers

| Layer | Purpose | When Agent Sees It | Update Frequency |
|-------|---------|-------------------|------------------|
| **MEMORY.md** | Boot context — immediate, curated summary | Instantly on startup (no commands needed) | Periodically (e.g., daily or weekly) |
| **Vault** | Full knowledge store — searchable, structured, versioned | Via `wake`, `context`, `search`, or auto-injection | Continuously during work |

### Mental Model

Think of these as complementary layers:

- **MEMORY.md** is the **executive summary** — a curated snapshot the agent sees immediately without running any commands. It contains high-level identity, key decisions, and current focus.

- **The vault** is the **full filing cabinet** — the complete, searchable, versioned knowledge store. It contains everything: tasks, decisions, lessons, observations, checkpoints, and more.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Context                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐         ┌──────────────────────────────┐ │
│   │   MEMORY.md      │         │         ClawVault            │ │
│   │   (Boot Context) │         │      (Full Knowledge)        │ │
│   │                  │         │                              │ │
│   │ • Identity       │         │ • decisions/                 │ │
│   │ • Key decisions  │◀────────│ • lessons/                   │ │
│   │ • Current focus  │ periodic│ • tasks/                     │ │
│   │ • Active project │  sync   │ • projects/                  │ │
│   │                  │         │ • handoffs/                  │ │
│   │ Instant access   │         │ • observations/              │ │
│   │ (no commands)    │         │                              │ │
│   └──────────────────┘         │ Searchable via:              │ │
│                                │ wake, context, search, inject│ │
│                                └──────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Pattern

1. **MEMORY.md contains:**
   - Project/agent identity and purpose
   - Key architectural decisions (summaries, not full reasoning)
   - Current focus and active work
   - Critical constraints or preferences
   - Links to vault for deeper context

2. **Vault contains:**
   - Full decision records with reasoning
   - All lessons learned
   - Task history and backlog
   - Session handoffs and checkpoints
   - Observations and reflections
   - People, projects, and relationships

3. **Update cadence:**
   - Vault: Updated continuously during work via `remember`, `checkpoint`, `sleep`, etc.
   - MEMORY.md: Updated periodically (daily or weekly) to reflect vault state

### Example MEMORY.md Structure

```markdown
# Project Memory

## Identity
AI assistant for the Acme Dashboard project. Primary focus: React frontend with TypeScript.

## Key Decisions
- Using PostgreSQL for persistence (see vault: decisions/use-postgresql.md)
- Tailwind CSS for styling
- React Query for server state

## Current Focus
- Shipping v2 onboarding flow
- Blocked on: API rate limiting design

## Working Agreements
- Always run tests before committing
- Use conventional commits
- Check `clawvault wake` output at session start

## Quick Links
- Active tasks: `clawvault task list --status active`
- Recent decisions: `clawvault list decisions --limit 5`
- Project context: `clawvault context "onboarding"`
```

### Avoiding Drift

The issue of "dual source of truth" arises when MEMORY.md and the vault diverge. To prevent this:

1. **Vault is authoritative** — When in doubt, the vault is the source of truth. MEMORY.md is a convenience layer.

2. **Periodic sync** — Update MEMORY.md periodically to reflect vault state. This can be:
   - Manual: Review and update at the start of each day/week
   - Semi-automated: Use `clawvault recap` output to inform updates

3. **Keep MEMORY.md lean** — Don't try to mirror the vault. Include only what the agent needs immediately on boot.

4. **Reference, don't duplicate** — Instead of copying full decision reasoning into MEMORY.md, reference the vault file.

5. **Trust the wake recap** — The `clawvault wake` command provides accurate vault state. If MEMORY.md conflicts with wake output, trust wake.

### When to Use Each

| Scenario | Use MEMORY.md | Use Vault |
|----------|---------------|-----------|
| Agent needs identity/purpose immediately | ✓ | |
| Storing a new decision | | ✓ |
| Quick reference to current focus | ✓ | |
| Searching past decisions | | ✓ |
| Session handoff | | ✓ |
| Checkpoint during work | | ✓ |
| High-level project constraints | ✓ | |
| Detailed task tracking | | ✓ |

### Alternative Approaches

Depending on your workflow, you might choose:

1. **Vault-only** — Delete MEMORY.md entirely and rely solely on `wake` + auto-injection. Works well if you always run `clawvault wake` at session start.

2. **Generated MEMORY.md** — Auto-generate MEMORY.md from vault state at `sleep`/`wake`. The vault remains the single source of truth, and MEMORY.md becomes a cached summary.

3. **Hybrid (recommended)** — Keep both, with MEMORY.md as a manually-curated executive summary that's updated periodically. This provides instant boot context while the vault handles everything else.

## Plugin Configuration

Configure ClawVault behavior via OpenClaw's config system:

```bash
# Set vault path
openclaw config set plugins.entries.clawvault.config.vaultPath ~/my-vault

# Explicitly opt into privileged features
openclaw config set plugins.entries.clawvault.config.allowClawvaultExec true
openclaw config set plugins.entries.clawvault.config.enableStartupRecovery true
openclaw config set plugins.entries.clawvault.config.enableSessionContextInjection true
openclaw config set plugins.entries.clawvault.config.enableAutoCheckpoint true

# Adjust context injection
openclaw config set plugins.entries.clawvault.config.maxContextResults 6
openclaw config set plugins.entries.clawvault.config.contextProfile planning
```

See [HOOK.md](../hooks/clawvault/HOOK.md) for all configuration options.

## Workflow Integration

### Session Lifecycle

```bash
# Start of session (hook auto-injects context, but explicit wake is recommended)
clawvault wake

# During work
clawvault checkpoint --working-on "feature X" --focus "edge cases"
clawvault remember decision "Use approach Y" --content "Reasoning..."

# End of session
clawvault sleep "completed feature X" --next "write tests" --blocked "waiting on API"
```

### Context Retrieval

```bash
# Get relevant context for a task
clawvault context "database migration"

# Use profiles for different scenarios
clawvault context --profile planning "Q1 roadmap"
clawvault context --profile incident "production issue"
```

## Troubleshooting

### MEMORY.md shows stale information

The vault is authoritative. Run `clawvault wake` to see current state, then update MEMORY.md to match.

### Agent confused by conflicting information

If MEMORY.md and vault conflict, instruct the agent to trust `clawvault wake` output over MEMORY.md content.

### Context injection not working

1. Verify hook is enabled: `openclaw hooks list --verbose`
2. Check vault path: `openclaw config get plugins.entries.clawvault`
3. Run compatibility check: `clawvault compat`

## Related Documentation

- [README: OpenClaw Integration](../README.md#openclaw-integration)
- [HOOK.md: Hook Configuration](../hooks/clawvault/HOOK.md)
- [SKILL.md: Skill Documentation](../SKILL.md)
