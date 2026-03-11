---
name: clawvault
description: "Context resilience - recovery detection, auto-checkpoint, and session context injection"
metadata:
  openclaw:
    emoji: "🐘"
    events: ["gateway:startup", "gateway:heartbeat", "command:new", "session:start", "compaction:memoryFlush", "cron.weekly"]
    requires:
      bins: ["clawvault"]
---

# ClawVault Hook

Integrates ClawVault's context death resilience into OpenClaw:

- **On gateway startup**: Checks for context death, alerts agent
- **On heartbeat**: Runs cheap threshold checks and observes active sessions when needed
- **On /new command**: Auto-checkpoints before session reset
- **On context compaction**: Forces incremental observation flush before context is lost
- **On session start**: Injects relevant vault context for the initial prompt
- **On weekly cron**: Runs `clawvault reflect` every Sunday midnight (UTC)

## Installation

```bash
npm install -g clawvault
openclaw hooks install clawvault
openclaw hooks enable clawvault

# Verify
openclaw hooks list --verbose
openclaw hooks info clawvault
openclaw hooks check
```

After enabling, restart your OpenClaw gateway process so hook registration reloads.

## Requirements

- ClawVault CLI installed globally
- Vault initialized (`clawvault setup` or `CLAWVAULT_PATH` set)

## What It Does

### Gateway Startup

1. Runs `clawvault recover --clear`
2. If context death detected, injects warning into first agent turn
3. Clears dirty death flag for clean session start

### Command: /new

1. Creates automatic checkpoint with session info
2. Captures state even if agent forgot to handoff
3. Ensures continuity across session resets

### Session Start

1. Extracts the initial user prompt (`context.initialPrompt` or first user message)
2. Runs `clawvault context "<prompt>" --format json --profile auto -v <vaultPath>`
   - Delegates profile selection to the shared context intent policy (`incident`, `planning`, `handoff`, or `default`)
3. Injects up to 4 relevant context bullets into session messages

Injection format:

```text
[ClawVault] Relevant context for this task:
- <title> (<age>): <snippet>
- <title> (<age>): <snippet>
```

### Event Compatibility

The hook accepts canonical OpenClaw events (`gateway:startup`, `gateway:heartbeat`, `command:new`, `session:start`, `compaction:memoryFlush`, `cron.weekly`) and tolerates alias payload shapes (`event`, `eventName`, `name`, `hook`, `trigger`) to remain robust across runtime wrappers.

## Configuration

### Plugin Configuration (Recommended)

Configure the plugin via OpenClaw's config system:

```bash
# Set vault path
openclaw config set plugins.entries.clawvault.config.vaultPath ~/my-vault

# View current config
openclaw config get plugins.entries.clawvault
```

Available configuration options (all privileged actions are opt-in):

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `vaultPath` | string | (auto-detected) | Path to the ClawVault vault directory |
| `agentVaults` | object | `{}` | Per-agent vault mapping |
| `allowClawvaultExec` | boolean | `false` | Required gate for all `child_process` calls |
| `clawvaultBinaryPath` | string | (PATH lookup) | Optional absolute path to `clawvault` binary |
| `clawvaultBinarySha256` | string | (unset) | Optional SHA-256 executable integrity check |
| `allowEnvAccess` | boolean | `false` | Allow env fallbacks (`OPENCLAW_*`, `CLAWVAULT_PATH`) |
| `enableStartupRecovery` | boolean | `false` | Enable `gateway:startup` recovery check |
| `enableSessionContextInjection` | boolean | `false` | Enable `session:start` recap/context injection |
| `enableAutoCheckpoint` | boolean | `false` | Enable checkpoint on `command:new` |
| `enableObserveOnNew` | boolean | `false` | Enable observer flush on `command:new` |
| `enableHeartbeatObservation` | boolean | `false` | Enable heartbeat-driven observation |
| `enableCompactionObservation` | boolean | `false` | Enable observer flush on compaction |
| `enableWeeklyReflection` | boolean | `false` | Enable weekly reflection cron |
| `enableFactExtraction` | boolean | `false` | Enable local fact extraction/entity graph updates |
| `autoCheckpoint` | boolean | `false` | Deprecated alias for `enableAutoCheckpoint` |
| `contextProfile` | string | `"auto"` | Default context profile (`default`, `planning`, `incident`, `handoff`, `auto`) |
| `maxContextResults` | integer | `4` | Maximum context results to inject on session start |
| `observeOnHeartbeat` | boolean | `false` | Deprecated alias for `enableHeartbeatObservation` |
| `weeklyReflection` | boolean | `false` | Deprecated alias for `enableWeeklyReflection` |

Security details and threat model: see [SECURITY.md](../../SECURITY.md).

### Vault Path Resolution

When `allowEnvAccess=true`, the hook resolves the vault path in this order:

1. Plugin config (`plugins.entries.clawvault.config.vaultPath` set via `openclaw config`)
2. `OPENCLAW_PLUGIN_CLAWVAULT_VAULTPATH` environment variable
3. `CLAWVAULT_PATH` environment variable
4. Walking up from cwd to find `.clawvault.json`
5. Checking `memory/` subdirectory (OpenClaw convention)

When `allowEnvAccess=false` (default), steps 2 and 3 are skipped.

### Troubleshooting

If `openclaw hooks enable clawvault` fails with hook-not-found, run `openclaw hooks install clawvault` first and verify discovery with `openclaw hooks list --verbose`.
