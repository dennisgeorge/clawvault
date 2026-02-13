# Compatibility Fixtures

This directory contains declarative fixtures used by `npm run test:compat-fixtures`.
Use `npm run test:compat-contract` when you only need contract validation (manifest/docs/runtime-label parity) without executing every fixture case.

- `cases.json` is the source of truth for expected outcomes.
  - includes `schemaVersion` for explicit contract evolution (current: `2`).
  - includes `expectedCheckLabels` to lock the compatibility check-label contract.
  - supports `expectedCheckStatuses`, `expectedDetailIncludes`, and `expectedHintIncludes`.
- Each case references a fixture folder with:
  - `package.json`
  - `SKILL.md`
  - `hooks/clawvault/HOOK.md`
  - `hooks/clawvault/handler.js`

Current fixture scenarios:

- order is intentionally kept in sync with `cases.json` and validated by the fixture runner.
- `healthy` — expected strict pass.
- `missing-requires-bin` — warning for missing metadata.openclaw.requires.bins.
- `non-auto-profile` — warning for missing --profile auto delegation.
- `missing-events` — error for missing required hook events.
- `missing-package-hook` — error for missing openclaw.hooks registration.
- `missing-skill-openclaw` — warning for missing metadata.openclaw in SKILL.md.
- `unsafe-hook-handler` — warning for unsafe hook execution conventions (execSync, missing shared profile delegation).
- `missing-skill-file` — warning for missing SKILL.md file entirely.
