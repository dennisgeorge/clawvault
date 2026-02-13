# Changelog

## [Unreleased]

### Added
- **Typed memory graph index** (`.clawvault/graph-index.json`) with schema versioning and incremental rebuild support.
- **Graph-aware context retrieval** for `clawvault context`:
  - blends semantic search with graph-neighbor context,
  - includes explain signals/rationale in JSON output.
- **`clawvault compat`** command for OpenClaw compatibility diagnostics.
- **`clawvault graph`** command for graph summary/refresh diagnostics.
- **Context profiles** for `clawvault context`:
  - `default`, `planning`, `incident`, `handoff`.
- **CLI command registration smoke tests** for modular command groups.
- **Expanded CLI registration smoke coverage** across maintenance/resilience/session-lifecycle/template modules, including duplicate-command detection.
- **CLI help contract tests** to lock command/option surface (including `context --profile auto` and `compat --strict`).
- **CLI runtime helper tests** covering shared vault resolution and qmd missing-binary error mapping.
- Runtime helper coverage now also validates qmd non-zero exit propagation and consistent qmd-missing user guidance output.
- CLI test harness now uses shared fixture helpers to reduce duplicated stubs and keep command-surface contract tests maintainable.
- Doctor now includes an **OpenClaw compatibility** check summary.
- Dashboard graph parser now emits:
  - typed nodes,
  - typed edges (`wiki_link`, `tag`, `frontmatter_relation`),
  - edge/node type statistics.

### Changed
- Dashboard edge diffing now includes edge type/label, enabling reliable live updates when relation type changes.
- Hook event matching now supports alias payload shapes (`event`, `eventName`, etc.) for better OpenClaw compatibility.
- `link` and `entities` commands now consistently respect `--vault` without requiring `CLAWVAULT_PATH`.
- Memory graph index now auto-refreshes on vault writes/reindex and link mutations, reducing stale graph context.
- `doctor` and `status` now report memory graph index presence/staleness to aid long-running agent hygiene.
- Dashboard now validates graph-index freshness before reuse, automatically falling back to markdown parsing when stale.
- CLI command registration is being modularized (`core`, `maintenance`, `template`, `resilience`, `session-lifecycle`, `vault-operations`, `query`) to improve maintainability.
- Hook `session:start` context injection now infers `context --profile` from prompt intent (incident/planning/handoff/default).
- `context --profile auto` now uses centralized intent inference, and hooks delegate profile selection through this shared path.
- Library API now exports context profile inference helpers for external integrations (`inferContextProfile`, `resolveContextProfile`).
- Main CLI now uses shared vault path resolution from the config library, reducing drift between command entrypoint and command modules.
- Config resolver test coverage now includes env-vs-discovery precedence and explicit missing-vault failure behavior.
- `clawvault compat --strict` now exits non-zero on warnings/errors for CI-friendly OpenClaw compatibility gates.
- CLI entrypoint runtime helpers (`getVault`, `runQmd`, qmd-missing handling) were extracted into a dedicated module to keep command bootstrap maintainable.
- Compatibility diagnostics now also validate hook manifest required bins metadata and hook handler delegation to `context --profile auto`.
- `compat` command now supports `--base-dir` to validate alternate project roots (used for fixture and CI contract checks).
- Added compatibility fixture matrix runner (`npm run test:compat-fixtures`) with healthy and drifted OpenClaw integration fixtures.
- Added GitHub Actions CI workflow running typecheck, tests, and compatibility fixture matrix.
- Added consolidated `npm run ci` local gate and wired CI workflow to use it for parity with local validation.
- Compatibility fixture matrix now validates additional hard-failure drift cases (missing required hook events, missing package hook registration) and asserts JSON report shape/signals.
- Compatibility fixture matrix expectations are now declarative via `tests/compat-fixtures/cases.json` for easier extension.
- Compatibility unit tests now assert command diagnostics against the declarative fixture expectations to keep CLI and fixture runner semantics aligned.
- Fixture matrix runner now validates required fixture file layout before execution to fail fast on malformed compatibility fixtures.
- Fixture matrix runner now supports `COMPAT_CASES` filtering for targeted local debugging of specific compatibility drift scenarios.
- Fixture matrix runner can now emit per-case JSON reports (`COMPAT_REPORT_DIR`) for CI failure triage and artifact upload.
- Compatibility fixture runner internals were extracted into reusable utilities with dedicated unit tests (schema selection/parsing/layout guards) to improve maintainability.
- Added `tests/compat-fixtures/README.md` documenting fixture layout and scenario intent for easier extension/review.
- Compatibility fixture runner now emits `summary.json` alongside per-case reports for faster CI artifact triage.
- Compatibility fixture manifest now includes explicit `schemaVersion` validation to make contract changes intentional and reviewable.
- Compatibility unit tests now assert expected diagnostic detail substrings from declarative cases, not only status/count outputs.
- Added `npm run test:compat-smoke` for fast healthy-fixture compatibility checks during local iteration.
- Added `npm run test:compat-fixtures:fast` for fixture checks without rebuilding, and updated smoke script to use fast mode.
- Compatibility fixture matrix now covers missing `SKILL.md` OpenClaw metadata as an explicit warning-drift scenario.
- Compatibility fixture matrix now also covers unsafe hook handler conventions (`execSync` and missing `--profile auto` delegation) as warning-drift scenarios.
- Compatibility fixture runner now enforces one-to-one coverage between declarative cases and fixture directories (missing/unreferenced fixture detection).
- Fixture README coverage validation now targets scenario-list entries specifically, avoiding false positives from structural bullet lists.
- `compat --base-dir` resolution is now strict to the provided root (no fallback to repository files), preventing false positives in fixture/CI validation.
- Declarative fixture cases now support `allowMissingFiles` for intentional missing-file drift scenarios (e.g., missing `SKILL.md`).
- Compatibility fixture runner now uses extracted case-evaluation logic with structured mismatch reporting, improving maintainability and debugging clarity.
- Declarative fixture cases can now assert compatibility diagnostic `hint` snippets (`expectedHintIncludes`) in addition to statuses/details.
- Compatibility fixture manifest now includes per-case descriptions, and fixture README coverage enforces description parity with declarative contracts.
- Compatibility fixture runner now validates declarative expected check labels against the live `compat` report schema (healthy fixture) to catch stale/typoed label contracts early.
- Compatibility fixture README coverage now also enforces scenario ordering parity with declarative `cases.json` to prevent review confusion and drift.
- Compatibility fixture manifest now declares `expectedCheckLabels`, and runner validation enforces both label set and label order parity against runtime compatibility output.
- Compatibility fixture manifest schema has been bumped to `schemaVersion: 2` to formalize the `expectedCheckLabels` contract addition.
- Compatibility command unit tests now also assert declarative expected check-label order and `expectedHintIncludes` contracts from fixture manifest.
- Compatibility fixture runner now supports contract-only mode (`COMPAT_VALIDATE_ONLY=1`) and dedicated scripts (`test:compat-contract`, `test:compat-contract:fast`) for quick manifest/docs/runtime-label validation.
- Compatibility smoke workflow now runs fast contract validation before the healthy fixture case, improving early drift detection during local iteration.
- Compatibility fixture summary artifacts now include execution metadata (`mode`, `schemaVersion`, `selectedCases`) for clearer CI triage across contract-only and full fixture runs.
- Compatibility report artifact writing (`summary.json`, per-case JSON) is now centralized in fixture-runner library utilities with dedicated unit coverage.
- Fixture contract validation now enforces coverage of every declared compatibility check label in `expectedCheckStatuses` (healthy case provides full-label baseline assertions).
- Fixture manifest validation now enforces stricter expectation consistency (exit code domain, non-negative warning/error counts, and exit-vs-count coherence) to prevent malformed declarative contracts.
- Consolidated `npm run ci` now includes build-backed contract validation (`test:compat-contract:fast`) before full compatibility fixture execution for earlier contract drift failure signals.
- `compat` diagnostics now warn when `openclaw --version` exits non-zero (not only missing binary), and skill metadata checks now parse frontmatter with explicit hint guidance for missing `metadata.openclaw`.
- Fast compatibility checks now validate build freshness (`src/commands/compat.ts` vs `dist/commands/compat.js`) and fail early on stale artifacts to prevent false local results.
- Skill metadata compatibility diagnostics now distinguish malformed `SKILL.md` frontmatter from missing metadata and emit clearer warning details with actionable hints.
- Compatibility fixture manifest now supports per-case `openclawExitCode`, and fixture matrix coverage includes a broken-CLI scenario to validate `openclaw --version` non-zero warning behavior.
- OpenClaw CLI compatibility checks now also report signal-terminated executions (e.g., `SIGTERM`) as warnings for clearer runtime readiness diagnostics.
- Compatibility fixture execution output now includes per-case `durationMs`, and summary artifacts include aggregate timing metadata for faster CI triage.
- Compatibility fixture contracts now support signal-based OpenClaw CLI simulation (`openclawSignal`), with matrix coverage for signal-terminated CLI readiness warnings.
- Fixture manifest validation now enforces that simulated non-ready OpenClaw CLI cases (`openclawExitCode != 0` or `openclawSignal`) explicitly assert `openclaw CLI available: warn`.
- Compatibility fixture runner now emits aggregate runtime telemetry (`totalDurationMs`, `averageDurationMs`) in summary artifacts and console output.
- Fixture manifest validation now rejects orphan detail/hint assertions by requiring `expectedDetailIncludes`/`expectedHintIncludes` labels to also be declared in `expectedCheckStatuses`.
- Compatibility fixture contracts now also support `openclawMissing` simulation to validate missing-binary warnings in the OpenClaw readiness check path.
- Compatibility summary artifacts now include both declarative and discovered runtime check-label lists (`expectedCheckLabels`, `runtimeCheckLabels`) for faster contract triage.
- Compatibility runtime telemetry now distinguishes preflight validation time (`preflightDurationMs`) and full run time (`overallDurationMs`) for clearer local/CI performance analysis.
- Fixture README contract validation now rejects duplicate scenario entries to prevent ambiguous documentation drift.
- Compatibility fixture runtime summary calculations are now centralized in a shared runner utility (`buildFixtureRunTelemetry`) with dedicated unit-test coverage.
- Compatibility runtime telemetry now highlights the slowest fixture cases in both console output and summary artifacts to speed up CI bottleneck triage.
- Hook handler safety diagnostics now also flag `execFileSync(..., { shell: true })` paths, with dedicated compatibility fixture coverage for shell-enabled execution drift.
- Compatibility fixture case selection now rejects duplicate `COMPAT_CASES` entries, preventing ambiguous targeted-run semantics.
- Compatibility fixture runner now logs the resolved case selection set before execution, improving observability for targeted `COMPAT_CASES` runs.
- Compatibility fixture selection now rejects empty/whitespace-only `COMPAT_CASES` expressions to avoid accidental zero-case executions.
- Fixture manifest validation now restricts `allowMissingFiles` entries to known required fixture paths, preventing typo-induced false assumptions in drift scenarios.
- Fixture manifest now enforces lowercase kebab-case identifiers for fixture case names, improving consistency between declarative contracts and directory naming.
- Compatibility summary generation now uses a shared fixture pass/fail summarizer utility, and summary artifacts explicitly include `passedCases` / `failedCases` lists for triage.
- Contract-only and full fixture summary artifacts now share a consistent telemetry field set (`averageDurationMs`, `overallDurationMs`, `slowestCases`, pass/fail lists) for stable downstream parsing.
- Compatibility summary artifacts are now explicitly schema-versioned (`summarySchemaVersion`) and built via a shared summary-header utility for contract/fixtures mode consistency.
- Summary header metadata now includes `selectedTotal` alongside `selectedCases` for easier targeted-run accounting in downstream tooling.
- Shared summary-header builder now validates array-field shape and duplicate entries (`selectedCases`, expected/runtime label lists), hardening report contract generation.
- Compatibility fixture runner now validates full summary artifact shape/invariants before writing, preventing malformed schema output from leaking into CI/report consumers.
- Summary validation now enforces mode-specific invariants: contract mode must remain zero-result metadata, while fixtures mode totals must match selected-case counts with bounded slowest-case lists.
- Compatibility summary validation now enforces fixture result-entry schema and coherence between `results`, pass/fail lists, and selected-case ordering, tightening downstream report contract guarantees.
- Summary validation now enforces `slowestCases` coherence with fixture results (expected count, descending duration order, and exact per-case duration parity), reducing telemetry drift risk.
- Compatibility summary validation now enforces pass/fail result semantics (failed cases must carry mismatch details, and passed cases must keep expected/actual exit-code parity).
- Summary artifact writing now centrally validates summary shape in `writeSummaryReport`, ensuring all report emitters share one enforcement path.
- Fixture manifest validation now requires `expectedCheckStatuses` labels to be declared in `expectedCheckLabels`, tightening declarative contract integrity.
- Added standalone compatibility summary artifact validator script (`scripts/validate-compat-summary.mjs`) plus convenience workflows (`test:compat-summary`, `test:compat-summary:fast`) for post-run/CI artifact contract checks.
- Consolidated `npm run ci` now uses standalone compatibility summary validation after fixture execution, adding artifact-level contract checks to the core local/CI gate.
- Case-report artifact writing now centrally validates compatibility report shape in `writeCaseReport`, aligning per-case artifact enforcement with summary writer safeguards.

## [1.11.2] - 2026-02-12

### Fixed
- **Entity-slug routing** — People/project observations now route to entity subfolders (`people/pedro/2026-02-12.md` instead of `people/2026-02-12.md`)
- **Root-level file prevention** — Observations never create files at vault root; always route to category folders
- **Entity name extraction** — Case-sensitive proper noun matching prevents capturing common words as entity names
- **Dedup improvements** — Router uses normalized content + Jaccard similarity to prevent duplicate entries

### Changed
- Router `appendToCategory` now resolves entity-aware file paths for people and projects categories
- Updated router tests to validate entity-slug subfolder structure

---

## [1.11.1] - 2026-02-11

### Fixed
- **Compressor priority enforcement** — Post-processes LLM output to upgrade misclassified priorities (decisions→🔴, preferences→🟡)
- **Temporal decay in reflector** — 🟢 observations older than 7 days auto-pruned; 🔴 always kept
- **Exec summary in wake** — Wake command now shows richer context with observation summaries
- **Dedup normalization** — Strips timestamps, wiki-links, and whitespace before comparing for duplicates

---

## [1.11.0] - 2026-02-11

### Removed
- **Cloud sync** — Removed entire `src/cloud/` module (client, config, queue, service, types)
- **`clawvault cloud` command** — Removed cloud sync CLI command
- All cloud-related dependencies and imports stripped

### Philosophy
- ClawVault is now fully local-first. Zero network calls except optional LLM API for observe compression.
- Local folder sync (`vault.sync()`) remains for Obsidian cross-platform workflows.

---

## [1.10.2] - 2026-02-10

### Added
- Auto wiki-links in routed observations for Obsidian graph view

---

## [1.10.1] - 2026-02-10

### Fixed
- Search docs: clarified memory_search vs clawvault search scope

---

## [1.10.0] - 2026-02-10

### Changed
- Clean repo: removed internal docs, SEO bloat, dist from git

---

## [1.9.6] - 2026-02-10

### Fixed
- Stress test fixes: priority calibration, budget enforcement, scoring, watch reliability, wake verbosity

---

## [1.9.5] - 2026-02-10

### Fixed
- Stronger decision detection in compressor

---

## [1.9.4] - 2026-02-10

### Fixed
- Enforce priority rules on LLM output, fix people routing patterns

---

## [1.9.3] - 2026-02-10

### Fixed
- Watch, dedup, budget, classification, people routing fixes

---

## [1.9.2] - 2026-02-10

### Added
- Gemini support for observer compressor (in addition to Anthropic + OpenAI)

---

## [1.9.1] - 2026-02-10

### Added
- Auto-observe on sleep/wake
- Context-aware token budgets for observation injection

---

## [1.9.0] - 2026-02-10

### Added
- **Observational memory system** — Compresses session transcripts into durable observations
- Observer, Compressor, Reflector, Router, SessionWatcher, SessionParser modules
- Priority system (🔴 critical, 🟡 notable, 🟢 info) with automatic classification
- Vault routing: observations auto-categorize to decisions/, people/, lessons/, etc.
- File watcher mode for real-time session observation
- One-shot compression via `--compress` flag

---

## [1.8.2] - 2026-02-09

### Fixed
- **Path validation** - OPENCLAW_HOME and OPENCLAW_STATE_DIR now properly validated (trimmed, require absolute paths)
- **Error handling** - `listAgents()` now wrapped in try/catch to handle malformed filesystem state gracefully

---

## [1.8.1] - 2026-02-09

### Added
- **OPENCLAW_HOME support** - Session utilities now respect the `OPENCLAW_HOME` environment variable for custom OpenClaw installations
- **OPENCLAW_STATE_DIR support** - Also supports `OPENCLAW_STATE_DIR` for overriding state/agent paths

### Compatibility
- Verified compatibility with OpenClaw v2026.2.9
- Hook handler confirmed working after OpenClaw's tsdown migration fix (#9295)
- Session transcript reading benefits from OpenClaw's parentId chain fix (#12283)

---

## [1.5.1] - 2026-02-06

### Security
- **Fixed shell injection vulnerability** in hooks/clawvault/handler.js
  - Changed from `execSync` (with shell) to `execFileSync` (no shell)
  - All arguments passed as array, never interpolated into shell string
  - Vault path validation: must be absolute, exist, and contain .clawvault.json

- **Fixed prompt injection vulnerability**
  - Checkpoint recovery data now sanitized before injection
  - Control characters stripped, markdown escaped, length limited
  - Session keys and command sources sanitized with strict allowlist

- **Removed direct GitHub dependency** for qmd
  - qmd moved to optional peer dependency
  - Users install separately: `npm install -g github:tobi/qmd`
  - ClawVault gracefully handles missing qmd

### Changed
- Hook now validates vault paths before use
- Error messages in hooks are now generic (no sensitive data leaked)

---

## [1.5.0] - 2026-02-06

### Added
- **`clawvault repair-session`** - Repair corrupted OpenClaw session transcripts
  - Detects orphaned `tool_result` blocks that reference non-existent `tool_use` IDs
  - Identifies aborted tool calls with partial JSON
  - Automatically relinks parent chain after removals
  - Creates backup before repair (configurable with `--no-backup`)
  - Dry-run mode with `--dry-run` to preview repairs
  - List sessions with `--list` flag
  - JSON output with `--json` for scripting
  
  **Problem solved:** When the Anthropic API rejects with "unexpected tool_use_id found in tool_result blocks", this command fixes the transcript so the session can continue without losing context.
  
  ```bash
  # Analyze without changing
  clawvault repair-session --dry-run
  
  # Repair current main session
  clawvault repair-session
  
  # Repair specific session
  clawvault repair-session --session <id> --agent <agent-id>
  ```

- **Session utilities** (`src/lib/session-utils.ts`)
  - `listAgents()` - Find all agents in ~/.openclaw/agents/
  - `findMainSession()` - Get current session for an agent
  - `findSessionById()` - Look up specific session
  - `getSessionFilePath()`, `backupSession()` - File helpers

### Tests
- Added 13 tests for session repair functionality
  - Transcript parsing
  - Tool use extraction from assistant messages
  - Corruption detection (aborted + orphaned)
  - Parent chain relinking
  - Dry-run mode
  - Backup creation

---

## [1.4.2] - 2026-02-06

### Added
- **OpenClaw Hook Integration** - Automatic context death resilience
  - `gateway:startup` event: Detects if previous session died, injects alert into first agent turn
  - `command:new` event: Auto-checkpoints before session reset
  - Install: `openclaw hooks install clawvault && openclaw hooks enable clawvault`
  - Hook ships with npm package via `openclaw.hooks` field in package.json

- **`clawvault wake`** - All-in-one session start command
  - Combines: `recover --clear` + `recap` + summary
  - Shows context death status, recent handoffs, what you were working on
  - Perfect for session startup ritual

- **`clawvault sleep <summary>`** - All-in-one session end command
  - Creates handoff with: --next, --blocked, --decisions, --questions, --feeling
  - Clears death flag
  - Optional git commit prompt (--no-git to skip)
  - Captures rich context before ending session

### Fixed
- Fixed readline import in sleep command (was using `readline/promises` which bundlers couldn't resolve)

### Changed
- Documentation updated for hook-first approach
- AGENTS.md simplified - hook handles basics, manual commands for rich context
- SKILL.md updated with OpenClaw Integration section

---

## [1.4.1] - 2026-02-05

### Added
- `clawvault doctor` - Vault health diagnostics
- `clawvault shell-init` - Shell integration setup

---

## [1.4.0] - 2026-02-04

### Added
- **qmd integration** - Semantic search via local embeddings
- `clawvault setup` - Auto-discovers OpenClaw memory folder
- `clawvault status` - Vault health, checkpoint age, qmd index
- `clawvault template` - List/create/add with 7 built-in templates
- `clawvault link --backlinks` - See what links to a file
- `clawvault link --orphans` - Find broken wiki-links

### Changed
- qmd is now required for semantic search functionality

---

## [1.3.x] - Earlier

- Initial release with core functionality
- Checkpoint/recover for context death resilience
- Handoff/recap for session continuity
- Wiki-linking and entity management
- Structured memory categories
