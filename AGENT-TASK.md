# Canvas Dashboard Stats Enhancement

## Overview

Enhance `clawvault canvas` to include operational stats about ClawVault usage — observation runs, reflections generated, tasks completed, session lifecycle events, and more. The dashboard should give an at-a-glance picture of how actively the vault is being used.

## What to Build

### 1. Vault Activity Stats Section in Canvas

Add a new group to the canvas dashboard called "📈 Vault Activity" that shows:

- **Observations**: Total observation count, date range (first → latest), average observations per day
- **Reflections**: Total reflection count, latest reflection date, weeks covered
- **Tasks**: Total created, completed, completion rate, avg time to completion
- **Sessions**: Total checkpoints, total handoffs, last checkpoint date
- **Captures**: Total documents in inbox (pending triage), total documents across all categories

### 2. Stats Collection Utility

Create `src/lib/vault-stats.ts` with a `collectVaultStats(vaultPath: string): VaultStats` function that gathers all the data by reading the filesystem:

```typescript
interface VaultStats {
  observations: {
    total: number;
    firstDate: string | null;
    latestDate: string | null;
    avgPerDay: number;
  };
  reflections: {
    total: number;
    latestDate: string | null;
    weeksCovered: number;
  };
  tasks: {
    total: number;
    open: number;
    inProgress: number;
    blocked: number;
    completed: number;
    completionRate: number; // 0-100
  };
  sessions: {
    checkpoints: number;
    handoffs: number;
    lastCheckpoint: string | null;
  };
  documents: {
    total: number;
    byCategory: Record<string, number>;
    inboxPending: number;
  };
  ledger: {
    rawTranscripts: number;
    totalLedgerSizeMB: number;
  };
}
```

**How to gather each stat:**
- Observations: count files in `ledger/observations/` (glob `*.md`)
- Reflections: count files in `ledger/reflections/` (glob `*.md`), parse filenames for week numbers
- Tasks: use existing `listTasks()` from `src/lib/task-utils.ts`, count by status
- Sessions: count files matching `*checkpoint*` and `*handoff*` patterns in `handoffs/` and root
- Documents: count `.md` files per category directory
- Ledger: count files in `ledger/raw/`, sum file sizes

### 3. Integration into Canvas Command

In `src/commands/canvas.ts`, add the vault activity group to the dashboard layout. Position it as a new section (suggest: bottom of right column or a third column).

Use text nodes with formatted stats:

```
**Vault Activity**

Observations: 47 (Feb 3 → Feb 14)
Avg: 3.9/day

Reflections: 2
Latest: Week 07 (2026)

Tasks: 8 total
✓ 3 done | ● 2 active | ○ 2 open | ⊘ 1 blocked
Completion: 37%

Documents: 409 across 16 categories
Inbox: 5 pending triage
```

### 4. Tests

Add tests in `src/lib/vault-stats.test.ts`:
- Test with empty vault (all zeros)
- Test with populated vault (mock files in temp dir)
- Test date parsing from observation filenames
- Test task status counting

Add tests in `src/commands/canvas.test.ts` (extend existing):
- Verify canvas output includes vault activity group
- Verify stats are rendered correctly

## File Structure

```
src/lib/vault-stats.ts          # NEW: stats collection
src/lib/vault-stats.test.ts     # NEW: stats tests
src/commands/canvas.ts           # MODIFY: add stats group
src/commands/canvas.test.ts      # MODIFY: extend tests
```

## Constraints

- Zero new dependencies — use only `fs`, `path`, `glob` (already a dependency)
- Follow existing code patterns in `src/lib/task-utils.ts` for file reading
- Follow existing canvas layout patterns in `src/lib/canvas-layout.ts` for node creation
- Stats collection must be synchronous (filesystem reads only, no async needed)
- Handle missing directories gracefully (return 0/null, don't throw)
- Do NOT modify any existing tests — only add new ones
- Do NOT modify `src/types.ts`

## Testing

```bash
npm run build    # Must succeed
npm test         # All existing tests must still pass
```

Reference test patterns: `src/lib/task-utils.test.ts`, `src/commands/canvas.test.ts`

## Reference Files

- Canvas generation: `src/commands/canvas.ts`
- Canvas layout utilities: `src/lib/canvas-layout.ts`
- Task utilities (pattern to follow): `src/lib/task-utils.ts`
- Types: `src/types.ts`
- Ledger utilities: `src/lib/ledger.ts`

## What Done Looks Like

1. `clawvault canvas` generates a dashboard that includes vault activity stats
2. Stats are accurate (match actual file counts)
3. All existing tests pass
4. New tests cover stats collection
5. Build succeeds with no TypeScript errors
