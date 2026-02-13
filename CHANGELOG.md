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
- Added dedicated unit tests for the standalone summary validator script (`scripts/validate-compat-summary.test.js`) covering success, missing-case-report failure, and env-based path resolution.
- Standalone summary validator script coverage now also includes explicit missing-input failure behavior to keep CLI error guidance stable.
- Compatibility summary workflow scripts now honor caller-provided `COMPAT_REPORT_DIR` (with `.compat-reports` fallback), aligning local/CI artifact destinations.
- Added `test:compat-summary:verify` for validating pre-existing summary artifacts directly (with optional path argument), enabling artifact-only checks without fixture re-execution.
- Expanded summary-artifact utility tests to cover malformed summary loading and fixtures-summary case-report validation failures, strengthening error-path contract confidence.
- GitHub Actions now uploads the generated compatibility `summary.json` artifact on every CI run (`compat-summary`) while retaining full report uploads on failures.
- Standalone summary validator CLI now supports explicit `--summary` and `--report-dir` options (with tested argument error handling), improving artifact-validation ergonomics.
- Standalone summary validator now provides explicit `--help` output and stricter unknown/missing-option-value argument handling.
- Compatibility report parsing/validation now enforces per-check schema (`label` uniqueness, valid statuses, optional detail/hint typing) and count coherence (`warnings`/`errors` must match status tallies).
- Standalone summary validator now supports `--allow-missing-case-reports` for summary-only validation contexts where per-case report files are unavailable.
- Standalone summary validator now supports `--json` output for machine-readable automation workflows.
- Validator JSON mode now emits schema-versioned success payloads and structured error payloads (`status:error`) for automation-friendly failure handling.
- Validator success JSON payloads now include summary/fixture schema version metadata, enabling downstream tooling to enforce schema compatibility explicitly.
- Standalone summary validator now supports `--out <file>` to persist structured success/error result payloads for pipeline artifact capture.
- CI `compat-summary` artifact now bundles both `summary.json` and `validator-result.json`, providing schema-level and validator-level outputs for downstream analysis.
- Validator payload contracts are now centralized in dedicated helpers (`scripts/lib/compat-summary-validator-output.mjs`) with unit coverage, reducing drift between CLI output generation and validation semantics.
- Standalone validator tests now verify `--out` error-payload persistence even when CLI argument parsing fails, hardening pipeline auditability for malformed invocations.
- Added standalone validator-result verification workflow (`validate-compat-validator-result.mjs`, `test:compat-validator-result:verify`) to validate emitted validator payload artifacts independently of summary generation.
- Validator-result verification now has its own structured output contract helpers (`scripts/lib/compat-validator-result-verifier-output.mjs`) and CLI support for `--json`, `--out`, and `--help` with dedicated test coverage.
- Validator-result verifier now supports `--require-ok` to enforce success-only payload status in strict automation pipelines.
- `test:compat-validator-result:verify` now enforces `--require-ok` by default, hardening local/CI artifact verification semantics.
- Added versioned JSON schema artifacts for validator payload outputs (`schemas/compat-summary-validator-output.schema.json`, `schemas/compat-validator-result-verifier-output.schema.json`) with schema-version contract tests.
- Added generic JSON schema validation CLI (`scripts/validate-json-schema.mjs`) and integrated `test:compat-validator-result:schema` into fast summary workflows to validate emitted validator-result artifacts against versioned schema contracts.
- Summary workflows now persist `schema-validator-result.json` (JSON-schema gate output), and CI bundles it alongside summary/validator-result artifacts for complete payload-contract audit trails.
- Added versioned schema/runtime contract for generic schema-validator payloads (`scripts/lib/json-schema-validator-output.mjs`, `schemas/json-schema-validator-output.schema.json`) and chained verification of `schema-validator-result.json` in `test:compat-summary:fast`.
- Added verifier-output artifact emission and schema validation chain (`validator-result-verifier-result.json`) via `test:compat-validator-result:verify:report` + `test:compat-validator-result:verify:schema`, with CI artifact bundling for full validator/verifier contract auditing.
- Added schema artifacts for core compatibility reports (`schemas/compat-summary.schema.json`, `schemas/compat-case-report.schema.json`) plus `scripts/validate-compat-report-schemas.mjs` and `test:compat-report-schemas:verify` integration in fast summary workflows.
- Added structured output contracts for report-schema validator runs (`scripts/lib/compat-report-schema-validator-output.mjs`, `schemas/compat-report-schema-validator-output.schema.json`) plus chained `report-schema-validator-result.json` emission/schema-validation in fast summary workflows and CI artifacts.
- Added compatibility artifact-bundle validator (`scripts/validate-compat-artifact-bundle.mjs`) with structured output contract/schema (`scripts/lib/compat-artifact-bundle-validator-output.mjs`, `schemas/compat-artifact-bundle-validator-output.schema.json`), integrated into fast summary workflows and CI artifact uploads (`artifact-bundle-validator-result.json`).
- Artifact-bundle validator output now embeds an `artifactContracts` manifest (artifact path + schema path/ID + version-field expected/actual values) to provide explicit contract-version traceability for external release gates.
- Artifact-bundle validation is now manifest-driven (`schemas/compat-artifact-bundle.manifest.json` + `scripts/lib/compat-artifact-bundle-manifest.mjs`) with schema validation (`schemas/compat-artifact-bundle.manifest.schema.json`, `test:compat-artifact-bundle:manifest:schema`) and optional `--manifest` override for controlled contract experiments.
- Shared validator CLI output plumbing is now centralized in `scripts/lib/validator-cli-utils.mjs` (JSON-mode detection, best-effort `--out` recovery, and validated payload writing) to reduce duplicated error-handling/path-writing logic across validator scripts.
- Shared JSON schema operations are now centralized in `scripts/lib/json-schema-utils.mjs` (JSON load helpers, Ajv factory, schema compilation, normalized schema-error formatting, and schema const/id extraction), reducing duplicated validator internals and hardening cross-validator consistency.
- Shared validator argument parsing helpers are now centralized in `scripts/lib/validator-arg-utils.mjs` (`readRequiredOptionValue`, flag-token helpers), reducing repeated `--option` missing-value guard code across validator CLIs while preserving existing error contracts.
- Shared validator CLI parser flow for `--help`/`--json`/`--out` plus script-specific options is now centralized in `scripts/lib/validator-cli-parser.mjs`, reducing duplicated option-loop boilerplate while preserving CLI error semantics.
- Added standalone artifact-bundle manifest verifier (`scripts/validate-compat-artifact-bundle-manifest.mjs`) with structured output contract/schema (`scripts/lib/compat-artifact-bundle-manifest-validator-output.mjs`, `schemas/compat-artifact-bundle-manifest-validator-output.schema.json`) and workflow/CI integration, enabling semantic manifest validation beyond JSON schema shape checks.
- Artifact-bundle validator now verifies `artifact-bundle-manifest-validator-result.json` as part of the end-to-end artifact contract set, and emitted bundle contract metadata/CI artifacts now include this manifest-verifier result artifact.
- Artifact-bundle validation now cross-checks the manifest-verifier payload’s artifact list and per-artifact schema contracts against the active manifest-derived runtime contracts, preventing stale manifest-verifier outputs from passing downstream bundle gates.
- Artifact-bundle validation now also enforces cross-artifact parity between summary/validator/verifier payloads (schema versions, totals, case-report mode, and verifier status/version fields), reducing false-green risk from stale or tampered intermediate validator artifacts.
- Bundle-validator coherence enforcement has been extracted into `scripts/lib/compat-artifact-bundle-coherence.mjs` with dedicated unit coverage, reducing validator-script complexity while preserving strict error semantics.
- Bundle-validator output payload shape checks now enforce parity between top-level artifact path fields and `artifactContracts` / `verifiedArtifacts` ordering, tightening contract integrity for downstream parsers.
- Manifest-validator output payload shape checks now enforce `artifacts`↔`schemaContracts` ordering parity and duplicate guards, improving integrity of emitted manifest contract metadata.
- Added a dedicated loader for validator-result verifier payloads (`loadValidatorResultVerifierPayload`) and wired bundle validation to use it, aligning verifier artifact loading/error semantics with other validator output helpers.
- Expanded artifact-bundle coherence helper coverage to include explicit contract-version parity and manifest expected-schema-version drift checks, hardening regression detection around schema contract mismatches.
- Artifact-bundle coherence now enforces that `report-schema-validator-result.summarySchemaPath` matches the active manifest-derived `summary.json` schema contract path, with dedicated drift coverage in helper and CLI-level tests.
- Artifact-bundle coherence now also enforces canonical `report-schema-validator-result.caseSchemaPath` parity with the active case-report schema contract path (`schemas/compat-case-report.schema.json`) to prevent drifted case-schema validation artifacts from passing bundle gates.
- `compat-artifact-bundle-validator-output` JSON schema now encodes required artifact presence in both `verifiedArtifacts` and `artifactContracts` (via `contains` constraints), making standalone schema validation stricter for downstream consumers.
- Manifest-validator runtime output shape checks now enforce `artifacts.length === artifactCount` explicitly, producing clearer diagnostics when emitted artifact lists drift from declared counts.
- Required compatibility artifact identifiers/path bindings are now centralized in `scripts/lib/compat-artifact-bundle-contracts.mjs` and consumed by validators/schema-contract tests, reducing duplication and drift risk across bundle-contract enforcement layers.
- Canonical compatibility contract paths are now centralized in `scripts/lib/compat-contract-paths.mjs` (summary schema, case-report schema, artifact-bundle manifest), and validator scripts now consume these helpers instead of duplicating fallback literals.
- Required compatibility artifact-name coverage is now enforced directly in the artifact-bundle manifest shape validator (`ensureCompatArtifactBundleManifestShape`), so manifest consumers fail fast before downstream bundle-validation orchestration.
- `compat-artifact-bundle.manifest.schema.json` now also encodes required artifact-name presence via `contains` constraints, tightening standalone schema-validation guarantees for manifest completeness.
- `compat-artifact-bundle-manifest-validator-output` runtime/schema contracts now both encode required artifact-name presence (`artifacts` + `schemaContracts`), strengthening standalone validation guarantees for emitted manifest-validator artifacts.
- Manifest and manifest-validator output contracts now also pin per-artifact `versionField` expectations for required artifacts (`summary.json` → `summarySchemaVersion`, all others → `outputSchemaVersion`) across both runtime shape guards and JSON-schema constraints.
- Manifest and manifest-validator output contracts now also pin required per-artifact `artifactFile` mappings (`artifactFile === artifactName`) across runtime and JSON-schema validation, tightening deterministic artifact-bundle contract semantics.
- Artifact-bundle validator output runtime/schema contracts now also pin required per-artifact `versionField` expectations in `artifactContracts`, tightening downstream payload tamper/drift detection.
- Bundle-validator required artifact-name coverage checks now rely on manifest-load guarantees; obsolete duplicate runtime helper logic was removed to reduce dead code and maintenance overhead.
- Manifest-validator CLI coverage now includes explicit missing-required-artifact manifest scenarios, locking in structured error semantics for incomplete manifest contracts.
- Artifact-bundle manifest runtime/schema contracts now enforce a strict required artifact set (exact cardinality + no unsupported `artifactName` entries), tightening manifest governance and surfacing unsupported extensions earlier.
- Artifact-bundle manifest-validator output runtime/schema contracts now enforce strict required artifact-set cardinality and supported `artifactName` domain (including schemaContracts), reducing ambiguous payload acceptance in standalone validator-output checks.
- Artifact-bundle validator output runtime/schema contracts now enforce strict required artifact-set cardinality/domain and required per-artifact `versionField` mapping across `artifactContracts`, tightening standalone output-contract integrity.
- Artifact-bundle manifest and validator output runtime contracts now require canonical required-artifact ordering, ensuring deterministic artifact contract arrays and reducing downstream parser drift risk.
- Artifact-bundle JSON schemas now also enforce canonical required-artifact ordering via fixed `prefixItems` contracts (manifest artifacts, manifest-validator `artifacts`/`schemaContracts`, and bundle-validator `verifiedArtifacts`/`artifactContracts`) to align standalone schema validation with runtime order invariants.
- Required artifact schema-contract metadata is now centralized (`artifactName` → canonical `schemaPath`/`schemaId`) and enforced across manifest, manifest-validator output, and bundle-validator output runtime contracts to reduce cross-layer drift risk.
- Manifest and validator output JSON schemas now also pin required per-artifact schema IDs (and schema-path suffix contracts for resolved payloads), aligning standalone schema validation with stricter runtime schema-contract invariants.
- Required artifact contract metadata is now published as canonical ordered definitions (`REQUIRED_COMPAT_ARTIFACT_BUNDLE_ARTIFACT_DEFINITIONS`) and reused by compatibility validator test fixtures, reducing duplicated artifact-contract literals and drift-prone fixture maintenance.
- Added a dedicated manifest drift-guard test (`compat-artifact-bundle-manifest-contract-alignment`) to enforce that `schemas/compat-artifact-bundle.manifest.json` remains fully aligned with canonical required artifact definitions (including order and per-artifact contract fields).
- Added a dedicated manifest-schema drift-guard test (`compat-artifact-bundle-manifest-schema-alignment`) to enforce that `schemas/compat-artifact-bundle.manifest.schema.json` remains aligned with canonical required artifact definitions across `contains` and fixed-order `prefixItems` constraints.
- Added dedicated output-schema drift-guard coverage (`compat-artifact-bundle-output-schema-alignment`) to enforce that bundle-validator and manifest-validator output schemas remain aligned with canonical artifact definitions across enum domains, fixed-order `prefixItems`, and per-artifact `contains` constraints.
- Extracted shared schema-alignment test helpers (`compat-artifact-bundle-schema-alignment-test-utils`) and refactored manifest/output drift-guard suites to reuse them, reducing repeated assertion logic and keeping contract-governance tests easier to extend safely.
- Artifact-bundle validator CLI coverage now includes explicit `--manifest` override drift failures for required `schemaPath` and `schemaId` mappings, ensuring custom manifest paths cannot bypass canonical schema-contract enforcement.
- Added `test:compat-artifact-alignment:fast` and wired it into `test:compat-artifact-stack:fast`, so artifact contract alignment drift guards now run as a first-class fast compatibility stack gate (not only via the full unit-test suite).
- Artifact-bundle validator CLI drift coverage now also asserts manifest-validator `schemaContracts[].schemaPath` resolution coherence against the active manifest contracts, catching tampered absolute-path rewrites that preserve schema-path suffix shape but drift from canonical resolved paths.
- Artifact-bundle validator CLI drift coverage now also exercises manifest-validator `schemaContracts[].schemaId` tampering, asserting early payload-contract rejection for canonical schema-ID drift before bundle-level coherence checks.
- Bundle-validator CLI manifest-validator drift tests now share a common fixture helper (`runManifestValidatorPayloadDriftScenario`), reducing repeated setup boilerplate while preserving explicit per-drift assertion contracts.
- Compatibility npm workflows are now modularized into composable stack scripts (`test:compat-report-stack:fast`, `test:compat-validator-stack:fast`, `test:compat-artifact-stack:fast`) so `test:compat-summary:fast` remains maintainable as contract gates grow.

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
