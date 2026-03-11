# Security Model: ClawVault OpenClaw Plugin

This document explains the security posture of the OpenClaw plugin (`hooks/clawvault/handler.js`), why child process execution exists, and how risk is constrained.

## Threat Model

### Trusted boundary
- Plugin source code in this repository.
- OpenClaw plugin config managed by the operator.
- Local filesystem paths explicitly configured by the operator.

### Untrusted inputs
- Event payload fields from runtime (`event`, `context`, `messages`, etc.).
- Environment variables (unless explicitly enabled by config).
- Shell PATH contents when executable paths are not pinned.

### Primary risks addressed
- **Command injection** via interpolated shell commands.
- **Binary confusion / PATH hijacking** (`clawvault` / `qmd` resolving to unexpected binaries).
- **Environment harvesting** (plugin reading broad process env surface).
- **Prompt/control-char injection** from event payloads into downstream prompts/messages.

## Why child process execution is required

The plugin integrates with the existing `clawvault` CLI as the compatibility contract with OpenClaw hooks.  
`clawvault context` and related commands may invoke `qmd` for retrieval/search. This is required for semantic/BM25 lookup and cannot be replaced by static in-process data access without duplicating core CLI behavior.

Security controls are applied around this execution path instead of removing it:
- explicit opt-in execution gate (`allowClawvaultExec`)
- absolute executable path resolution
- argument-array execution (no shell string interpolation)
- optional executable hash verification

## Execution hardening controls

`hooks/clawvault/integrity.js` implements:
- `resolveExecutablePath(...)`  
  Resolves an absolute executable path (explicit path or PATH search), rejects non-executable targets.
- `sanitizeExecArgs(...)`  
  Enforces array-based argv and rejects null-byte arguments.
- `verifyExecutableIntegrity(...)`  
  Optional SHA-256 verification for pinned binary integrity.

`hooks/clawvault/handler.js` enforces:
- `shell: false` for all `execFileSync` calls.
- No string-concatenated command lines.
- Execution only when `allowClawvaultExec=true`.

## Privileged feature opt-ins

All privileged plugin behavior is disabled unless explicitly enabled in plugin config:

- `allowClawvaultExec`
- `allowEnvAccess`
- `enableStartupRecovery`
- `enableSessionContextInjection`
- `enableAutoCheckpoint`
- `enableObserveOnNew`
- `enableHeartbeatObservation`
- `enableCompactionObservation`
- `enableWeeklyReflection`
- `enableFactExtraction`

Legacy aliases remain supported for compatibility (`autoCheckpoint`, `observeOnHeartbeat`, `weeklyReflection`), but explicit `enable*` keys are preferred.

## Environment variables accessed (and why)

The plugin intentionally limits env reads to a documented allowlist:

- `OPENCLAW_STATE_DIR` *(only when `allowEnvAccess=true`)*  
  Resolve OpenClaw state location for active-session observation.
- `OPENCLAW_HOME` *(only when `allowEnvAccess=true`)*  
  Fallback state root for OpenClaw session files.
- `OPENCLAW_PLUGIN_CLAWVAULT_VAULTPATH` *(only when `allowEnvAccess=true`)*  
  OpenClaw-injected vault path fallback.
- `CLAWVAULT_PATH` *(only when `allowEnvAccess=true`)*  
  Operator-provided fallback vault path.
- `OPENCLAW_AGENT_ID` *(only when `allowEnvAccess=true`)*  
  Agent resolution fallback when session key is absent.
- `PATH` / `PATHEXT`  
  Used only for executable path resolution when `clawvaultBinaryPath` is not pinned.

No broad environment enumeration is performed.

## Recommended hardened configuration

Use pinned binary path + checksum and keep env access disabled unless required:

```json
{
  "allowClawvaultExec": true,
  "clawvaultBinaryPath": "/usr/local/bin/clawvault",
  "clawvaultBinarySha256": "<64-char sha256>",
  "allowEnvAccess": false,
  "enableStartupRecovery": true,
  "enableSessionContextInjection": true
}
```

## Reporting

If you discover a vulnerability, open a security issue with:
- affected version(s)
- reproduction steps
- impact assessment
- suggested mitigation
