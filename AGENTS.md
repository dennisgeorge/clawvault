# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

ClawVault is a structured persistent memory system for AI agents. It stores memories as Obsidian-compatible markdown files. See `README.md` for full documentation.

### Development commands

Standard commands are in `package.json` scripts:

- `npm install` — install dependencies
- `npm run build` — compile TypeScript via tsup (required before `bin/` tests pass)
- `npm run typecheck` — type-check without emitting
- `npm test` — run vitest (564 tests across 79 files)
- `npm run dev` — watch mode build (tsup)
- `npm run ci` — typecheck + test + build

### Key gotchas

- **Build before testing**: 8 test suites under `bin/` import from `dist/` and will fail unless you run `npm run build` first. The remaining 71 test files work without a build.
- **ESLint not installed**: `npm run lint` is defined but ESLint is not in `devDependencies`. Running it gives `eslint: not found`. This is an upstream gap, not an environment issue.
- **`qmd` external dependency**: The CLI requires `qmd` (BM25/vector search engine) on `PATH` for vault operations (`init`, `search`, `context`, etc.). Tests gracefully skip `qmd`-dependent paths when it is absent. To install: `bun install -g github:tobi/qmd` then build it and link the binary. The `qmd` binary must also be trusted via `bun pm trust` since postinstalls are blocked by default.
- **Dashboard**: `node dashboard/server.js --vault <path>` starts a web dashboard on port 3377 (Express + WebSocket + force-graph).
- **LLM API keys optional**: Observer/reflector/compressor features require API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) but are not needed for core CLI or testing.

### Workgraph (v3) — Multi-Agent Coordination

The workgraph layer lives in `src/workgraph/` with four modules:

- `registry.ts` — Dynamic primitive type registry. 6 built-in types + agents define new types at runtime.
- `ledger.ts` — Append-only event log (`.clawvault/ledger.jsonl`). Source of truth for claims and coordination.
- `store.ts` — CRUD for primitives (markdown files with frontmatter). Every mutation logged to ledger.
- `thread.ts` — Thread lifecycle: create → claim → active → done (with block/release/cancel).
- `types.ts` — Type definitions for the system.

Key patterns:
- **Claim exclusivity**: The ledger tracks who owns what. `thread.claim()` fails if already claimed.
- **Dynamic types**: `registry.defineType()` creates new primitive types at runtime. This is how abstractions compound.
- **Soft schemas**: Field defaults applied, but unknown fields preserved. Schemas suggest, don't enforce.
- **Audit trail**: Every mutation in ledger.jsonl. Query with `ledger.historyOf()`, `ledger.allClaims()`, etc.

See `SKILL.md` "Workgraph" section for the full agent-native API reference.
