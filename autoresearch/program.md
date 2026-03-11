# ClawVault Autoresearch

This is a continuous autonomous research loop for improving ClawVault — an agent memory system.

## Setup

To set up a new experiment run:

1. **Agree on a run tag**: propose a tag based on today's date (e.g. `mar11`). The branch `autoresearch/<tag>` must not already exist.
2. **Create the branch**: `git checkout -b autoresearch/<tag>` from current master.
3. **Read the codebase**: The repo has ~37K lines across these key areas:
   - `src/observer/` — Observational memory pipeline (compressor, observer, session parser, active observer)
   - `src/observer/benchmark/` — Quality benchmark harness with scoring (precision, recall, keyword preservation, type accuracy)
   - `src/lib/` — Core library (config, ledger, search, injection, context, observation format/reader)
   - `src/commands/` — CLI commands (observe, benchmark, sleep, wake, checkpoint, search, etc.)
   - `testdata/observer-benchmark/` — Benchmark fixtures (transcripts + expected observations)
4. **Verify benchmark works**: Run `npx clawvault benchmark observer --provider mock --report-format json` and confirm it outputs scores.
5. **Initialize results.tsv**: Create `autoresearch/results.tsv` with the header row. Run baseline first.
6. **Confirm and go**.

## What You're Optimizing

ClawVault compresses raw AI session transcripts into durable, searchable observations. The system has multiple subsystems that all contribute to memory quality:

### Primary Target: Overall Memory Quality Score
The benchmark (`npx clawvault benchmark observer`) measures four dimensions:
- **Precision** — How much noise? Routine confirmations, CLI errors, retries should NOT become observations.
- **Recall** — Did it catch decisions, commitments, milestones, blockers?
- **Keyword preservation** — Can you search for the observation later? Or did the LLM rewrite key terms?
- **Type accuracy** — Are `[decision]` tags actually decisions? Are `[todo]` tags actionable?

**Current baseline (Gemini Flash): 82.0% overall (72% precision, 100% recall, 71.6% keyword preservation)**
**Target: 95%+ overall**

### Secondary Targets (improve anything that makes memory more useful)
- **Search quality** — BM25 + optional semantic search in `src/lib/search/`. Can observations be retrieved effectively?
- **Context injection** — How observations get injected into agent context (`src/lib/inject.ts`). Priority ordering, budget management.
- **Observation format** — The markdown format with `[type|c=X|i=X]` tags (`src/lib/observation-format.ts`). Is this optimal?
- **Compression prompt** — The LLM prompt in `src/observer/compressor.ts` `buildPrompt()` method (~line 385).
- **Post-processing** — Regex-based priority enforcement, dedup, noise filtering after LLM output.
- **Fixture quality** — More and better benchmark fixtures = better evaluation signal.
- **Test coverage** — New tests that catch regressions in memory quality.

## Experimentation

Each experiment modifies ClawVault code, runs the benchmark, and measures the result.

**What you CAN do:**
- Modify ANY file in `src/` — observer pipeline, search, injection, format, commands, anything
- Add new benchmark fixtures in `testdata/observer-benchmark/`
- Add new tests
- Modify the compressor prompt, post-processing logic, scoring functions
- Add new CLI commands or flags
- Refactor for clarity/simplicity

**What you CANNOT do:**
- Add new npm dependencies (zero new deps constraint)
- Break existing tests (all 450+ must pass)
- Remove the benchmark harness or change its scoring interface
- Modify files outside `src/`, `testdata/`, `docs/`, `autoresearch/`

**The goal: get the highest overall benchmark score (target 95%+) while keeping all tests passing.**

The scoring weights are: precision 25%, recall 25%, keyword preservation 25%, type accuracy 25%.

## Running an Experiment

```bash
# 1. Build
npm run build 2>&1 | tail -5

# 2. Run all tests (must pass)
npx vitest run 2>&1 | tail -20

# 3. Run benchmark with mock provider (fast, deterministic — for CI-safe scoring)
npx clawvault benchmark observer --provider mock --report-format json > autoresearch/run-mock.json 2>&1

# 4. Run benchmark with real LLM (the true metric)
npx clawvault benchmark observer --provider gemini --report-format json > autoresearch/run-gemini.json 2>&1

# 5. Extract scores
cat autoresearch/run-gemini.json | python3 -c "import sys,json;d=json.load(sys.stdin);m=d['aggregate'];print(f'overall={m[\"overall\"]:.1f}% precision={m[\"precision\"]:.1f}% recall={m[\"recall\"]:.1f}% keyword={m[\"keywordPreservation\"]:.1f}% type={m[\"typeAccuracy\"]:.1f}%')"
```

Total experiment time: ~30-60 seconds (build + test subset + benchmark).

For full test suite validation, run `npx vitest run` periodically (every 3-5 experiments).

## Logging Results

Log every experiment to `autoresearch/results.tsv` (tab-separated):

```
commit	overall	precision	recall	keyword	type_accuracy	status	description
```

1. git commit hash (short, 7 chars)
2. overall score (e.g. 82.0)
3. precision (e.g. 72.0)
4. recall (e.g. 100.0)
5. keyword preservation (e.g. 71.6)
6. type accuracy (e.g. 73.3)
7. status: `keep`, `discard`, or `crash`
8. short description of what this experiment tried

Example:
```
commit	overall	precision	recall	keyword	type_accuracy	status	description
a1b2c3d	82.0	72.0	100.0	71.6	73.3	keep	baseline (gemini flash)
b2c3d4e	85.5	80.0	100.0	78.0	73.3	keep	added keyword preservation instruction to prompt
c3d4e5f	81.0	68.0	100.0	75.0	73.3	discard	tried JSON output format (worse precision)
```

## The Experiment Loop

LOOP FOREVER:

1. Look at the git state and recent results in results.tsv
2. Formulate a hypothesis about what will improve the score
3. Modify the code (could be prompt engineering, post-processing, new fixtures, format changes, search improvements — ANYTHING in scope)
4. git commit with a descriptive message
5. Build and run benchmark (redirect output — do NOT flood context)
6. Extract and record results
7. If overall score improved OR a specific dimension improved without regressing others, KEEP (advance branch)
8. If overall score worsened, DISCARD (git reset)
9. Every 5 experiments, run the full test suite to catch regressions

**Experiment ideas to explore (not exhaustive — think of your own):**
- Prompt engineering: keyword preservation instructions, noise filtering examples, type assignment calibration
- Post-compression verification: check key terms survived compression, auto-fix rewrites
- Retrieval simulation: score observations by how well they'd match future search queries
- Importance calibration: test whether i-scores correlate with actual importance
- Structured output experiments: would JSON intermediate format improve consistency?
- Fixture expansion: create realistic long transcripts from diverse scenarios
- Observation dedup: merge semantically similar observations
- Source attribution: preserve speaker/agent identity through compression
- Context-aware compression: use existing vault state to avoid redundant observations
- Search integration: test if stored observations are actually findable via `clawvault search`

**NEVER STOP**: Once the loop begins, do NOT pause to ask the human anything. The human is asleep. You are autonomous. If you run out of ideas, re-read the codebase, study the scoring functions, analyze failure cases in the benchmark output, try combining previous near-misses, try radical approaches. The loop runs until manually interrupted.

## Research Log

After every 10 experiments, write a summary to `autoresearch/research-log.md` documenting:
- What you've tried
- What worked and why
- What didn't work and why
- Current best score and the specific changes that got there
- Next hypotheses to test

This log is for the human to read when they wake up.
