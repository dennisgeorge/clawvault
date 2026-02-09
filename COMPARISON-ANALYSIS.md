# ClawVault vs OpenClaw-Graphiti-Memory: Architectural Comparison

*Analysis Date: 2026-02-09*

## Executive Summary

**ClawVault** is a file-based, single-agent memory system optimized for context death resilience and Obsidian compatibility. It excels at session continuity and local-first operation.

**OpenClaw-Graphiti-Memory** is a three-layer hybrid system designed for multi-agent deployments, combining QMD vector search, shared reference files, and a Graphiti temporal knowledge graph. It excels at cross-agent knowledge sharing and temporal reasoning.

**Key insight:** These systems are complementary, not competing. ClawVault solves the "single agent survival" problem well; Graphiti solves the "multi-agent coordination" problem well. The ideal solution combines both.

---

## 1. Feature Comparison Matrix

| Feature | ClawVault | Graphiti Hybrid | Winner |
|---------|-----------|-----------------|--------|
| **Storage Mechanism** | Markdown files (local) | Neo4j graph + shared files | Tie (different trade-offs) |
| **Keyword Search** | qmd BM25 (local) | QMD + Graphiti | Tie |
| **Semantic Search** | qmd vsearch (local embeddings) | QMD + OpenAI embeddings | ClawVault (no API cost) |
| **Temporal Search** | ❌ Limited (file timestamps) | ✅ First-class (bi-temporal) | **Graphiti** |
| **Entity Extraction** | Manual wiki-links | Automatic via LLM | **Graphiti** |
| **Multi-Agent Support** | ❌ Single vault | ✅ Group namespaces | **Graphiti** |
| **Cross-Agent Sharing** | ❌ None | ✅ Via shared groups | **Graphiti** |
| **Context Injection** | Manual (recap on wake) | ✅ Dynamic per-query | **Graphiti** |
| **Session Resilience** | ✅ Excellent (checkpoint/handoff/dirty-death) | ❌ Not addressed | **ClawVault** |
| **Context Death Detection** | ✅ Automatic hooks | ❌ None | **ClawVault** |
| **Obsidian Compatibility** | ✅ Full (wiki-links, graph view) | ❌ None | **ClawVault** |
| **Infrastructure** | Local only (Node.js, qmd) | Docker (Neo4j, Graphiti, OpenAI) | **ClawVault** |
| **API Costs** | $0 (local embeddings) | ~$1-5/month (OpenAI for extraction) | **ClawVault** |
| **Setup Complexity** | `npm install -g clawvault` | Docker Compose + config | **ClawVault** |
| **Relationship Modeling** | Wiki-links (flat) | Graph edges (typed, weighted) | **Graphiti** |
| **Fact Expiration** | ❌ Manual | ✅ Automatic (superseded facts) | **Graphiti** |
| **Query Expansion** | qmd query command | LLM-enhanced retrieval | Tie |

---

## 2. Where ClawVault is BETTER

### 2.1 Context Death Resilience (Major Strength)
ClawVault has a sophisticated multi-layer defense system:

```
Layer 1: Periodic checkpoints (HEARTBEAT integration)
Layer 2: Auto-checkpoint on /new (OpenClaw hook)
Layer 3: Dirty-death flag detection on startup
Layer 4: Recovery message injection on bootstrap
```

**Key files:**
- `checkpoint.ts` — Debounced writes, urgent wake, session state tracking
- `recover.ts` — Dirty death detection, handoff loading
- `hooks/clawvault/handler.js` — OpenClaw integration for auto-save

Graphiti has **zero** session resilience features. If an agent dies mid-task, there's no recovery mechanism.

### 2.2 Zero Infrastructure / Local-First
ClawVault requires only:
- Node.js 18+
- qmd (local BM25 + local embeddings)

No Docker, no external APIs, no network dependency. Works offline.

### 2.3 Obsidian Compatibility
- Full wiki-link support (`[[entity-name]]`)
- Auto-linking entity system
- Compatible with Obsidian's graph view
- Human-readable markdown files

### 2.4 Cost
- $0 ongoing cost (local embeddings via qmd)
- No API quotas or rate limits
- Predictable performance

### 2.5 Doctor Command (Health Checks)
`clawvault doctor` provides comprehensive vault health monitoring:
- qmd installation status
- Shell config verification
- Handoff freshness
- Checkpoint staleness
- Orphan link detection
- Inbox backlog warnings

---

## 3. Where Graphiti is BETTER

### 3.1 Temporal Reasoning (Major Strength)
Graphiti uses **bi-temporal modeling**:
- **Valid time:** When the fact was true in reality
- **Transaction time:** When the fact was recorded

This enables queries like:
- "What did we know about X as of last Tuesday?"
- "What changed in our understanding of X over time?"
- "Show me facts that were superseded"

ClawVault only has file modification timestamps — no temporal validity tracking.

### 3.2 Multi-Agent Architecture
Graphiti's group namespace system is elegant:

```
clawdbot-clawd   → Orchestrator's knowledge
clawdbot-piper   → Email agent's discoveries
clawdbot-paige   → Finance agent's insights
user-main        → User profile (orchestrator-only)
system-shared    → Infrastructure (orchestrator-only)
```

Rules:
- Agents write to their own group only
- Agents read cross-group (shared memory)
- Only orchestrator writes to system groups

ClawVault has no multi-agent concept at all.

### 3.3 Automatic Entity Extraction
Graphiti uses LLM (GPT-4) to automatically extract:
- Named entities (people, places, orgs)
- Relationships between entities
- Temporal facts with validity periods

ClawVault relies on manual wiki-links or the auto-linker (which only links known entities, doesn't discover new ones).

### 3.4 Graph-Native Queries
Neo4j enables relationship traversal queries:
- "Who knows the accountant?"
- "What decisions led to this outcome?"
- "Show the chain of custody for this information"

ClawVault's wiki-links are flat — no typed relationships, no traversal.

### 3.5 Dynamic Context Injection
The `graphiti-context.sh` script gathers task-relevant context automatically:

```bash
graphiti-context.sh "task description" agent_id
```

This queries multiple groups and returns synthesized context before task execution.

ClawVault's `wake` command provides static recap, not query-specific context.

---

## 4. Critical Missing Features in ClawVault

### 4.1 Dynamic Context Injection (CRITICAL)
**Problem:** ClawVault's `wake` provides the same recap regardless of what the agent is about to work on. It doesn't inject task-relevant memories.

**What Graphiti does:**
```bash
# Before any task, query for relevant context
graphiti-context.sh "process invoice from Acme Corp" agent_id
# Returns: past invoices, Acme contact info, payment history, etc.
```

**Proposed solution for ClawVault:**
```bash
clawvault context "query about specific task"
# Searches vault semantically, returns relevant docs
# Could be auto-called by OpenClaw hook on session start
```

**Implementation:**
1. Add `context` command that takes a task description
2. Run vsearch + temporal weighting (recent docs boosted)
3. Return top N relevant memories formatted for injection
4. Optional: OpenClaw hook on `session:start` that extracts task from first message

### 4.2 Multi-Agent Support (HIGH PRIORITY)
**Problem:** ClawVault assumes one agent = one vault. In multi-agent setups, agents can't share knowledge.

**Proposed architecture:**
```
vaults/
├── _shared/              # Read by all, write by orchestrator
│   ├── user-profile.md
│   ├── agent-roster.md
│   └── infrastructure.md
├── clawd/                # Orchestrator's vault
│   └── memory/
├── piper/                # Email agent's vault
│   └── memory/
└── paige/                # Finance agent's vault
    └── memory/
```

**Implementation:**
1. Add `--shared` flag to clawvault commands
2. `clawvault search "query" --shared` searches shared + personal
3. `clawvault store --shared` writes to shared vault (orchestrator only)
4. Config: `sharedVaultPath` in `.clawvault.json`

### 4.3 Temporal Awareness (MEDIUM PRIORITY)
**Problem:** ClawVault treats all facts as equally valid. A decision from 6 months ago is weighted the same as yesterday's.

**Proposed solution:**
1. Add `valid_from` and `valid_until` frontmatter fields
2. Add `--supersedes` flag: `clawvault remember decision "New choice" --supersedes decisions/old-choice`
3. Search weighting: recent facts score higher by default
4. `clawvault search "query" --as-of "2026-01-15"` for historical queries

### 4.4 Cross-Agent Event Bus (MEDIUM PRIORITY)
**Problem:** Agents can't notify each other of relevant discoveries.

**Graphiti's approach:** Agents write to their group; other agents search cross-group.

**Alternative for ClawVault:**
1. Shared inbox: `clawvault notify piper "Found invoice from Acme"`
2. Creates file in `vaults/piper/memory/inbox/from-clawd-{timestamp}.md`
3. Receiving agent picks up on next wake

### 4.5 Relationship Typing (LOW PRIORITY)
**Problem:** Wiki-links are untyped. `[[pedro]]` doesn't indicate the relationship type.

**Possible enhancement:**
```markdown
[[pedro|owner]]           # Relationship type in alias
[[hale-pet-door|client]]  # Client relationship
```

Or frontmatter:
```yaml
relationships:
  - target: people/pedro
    type: owner
    since: 2025-01-01
```

---

## 5. Implementation Roadmap

### Phase 1: Quick Wins (1-3 days each)

#### 1.1 `clawvault context` Command
```bash
clawvault context "process invoice from Acme Corp"
# Returns semantically relevant memories for this task
```

**Implementation:**
- New command in `src/commands/context.ts`
- Uses existing `vsearch` + temporal boost
- Formats output for context injection
- ~50 lines of code

#### 1.2 Temporal Search Weighting
Add `--recent` flag to search commands:
```bash
clawvault search "deployment" --recent  # Boost recent docs
clawvault vsearch "budget" --recent
```

**Implementation:**
- Modify `SearchOptions` to include `temporalBoost?: number`
- Apply decay function to scores based on age
- ~30 lines in `search.ts`

#### 1.3 Session Start Hook
Auto-inject relevant context on session start:
```javascript
// In hooks/clawvault/handler.js
if (event.type === 'session' && event.action === 'start') {
  const firstMessage = event.context?.initialPrompt;
  if (firstMessage) {
    const context = await runClawvault(['context', firstMessage, '-v', vaultPath]);
    event.messages.push(context.output);
  }
}
```

### Phase 2: Medium-Term (1-2 weeks each)

#### 2.1 Shared Vault Architecture
- Add `sharedVaultPath` to config
- Symlink `shared/` into workspace
- Add `--shared` flag to search/store
- Create `clawvault shared` subcommand

#### 2.2 Fact Supersession
```bash
clawvault remember decision "Use Supabase" --supersedes decisions/use-firebase
```

- Adds `superseded_by` frontmatter to old doc
- Old doc excluded from default searches
- `--include-superseded` flag to see all

#### 2.3 Agent Notification System
```bash
clawvault notify piper "Found relevant email about taxes"
```

- Creates inbox item in target agent's vault
- Target sees notification on `clawvault wake`
- Optional: webhook/SSE for real-time

### Phase 3: Long-Term Vision (1-3 months)

#### 3.1 Optional Graphiti Integration
For users who want temporal graph features:
```bash
clawvault setup --graphiti  # Enables Graphiti sync
clawvault sync-graphiti     # Sync vault to knowledge graph
```

- Keeps file-based system as source of truth
- Graphiti as optional enhancement layer
- Best of both worlds

#### 3.2 LLM-Powered Auto-Extraction
On document store:
1. Extract entities using LLM (optional, paid feature)
2. Auto-create wiki-links
3. Suggest relationships

```bash
clawvault remember lesson "Tax filing deadline..." --auto-extract
# Detects: [[tax-filing]], [[deadline:april-15]], [[accountant:bob]]
```

#### 3.3 Cross-Vault Graph View
Unified Obsidian-compatible graph across all agent vaults:
- Shared entities connected across vaults
- Color-coded by source agent
- Export as single vault for visualization

---

## 6. Recommended Architecture: ClawVault + Graphiti Hybrid

For production multi-agent deployments, use **both systems**:

```
┌─────────────────────────────────────────────────────────────┐
│                     Memory Architecture                      │
│                                                              │
│  Layer 1: ClawVault (Per-Agent)                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • Session resilience (checkpoint/handoff/wake/sleep) │   │
│  │ • Obsidian-compatible markdown files                 │   │
│  │ • Local semantic search (qmd)                        │   │
│  │ • Zero-cost operation                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           │ sync (optional)                  │
│                           ▼                                  │
│  Layer 2: Graphiti (Shared Knowledge Graph)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • Temporal fact storage with validity periods        │   │
│  │ • Cross-agent knowledge sharing                      │   │
│  │ • Automatic entity extraction                        │   │
│  │ • Graph queries for relationship traversal           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Layer 3: Shared Files (_shared/)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • User profile, agent roster, infrastructure         │   │
│  │ • Read by all, write by orchestrator                 │   │
│  │ • No external dependencies                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**When to use which:**

| Task | Use |
|------|-----|
| "Save my current work state" | ClawVault (checkpoint/sleep) |
| "What was I doing?" | ClawVault (wake/recap) |
| "What did Piper find about X?" | Graphiti (cross-group search) |
| "What changed about X over time?" | Graphiti (temporal query) |
| "Search my personal notes" | ClawVault (search/vsearch) |
| "Get context for this task" | ClawVault context + Graphiti |

---

## 7. Conclusion

**ClawVault's unique strengths:**
- Best-in-class context death resilience
- Zero infrastructure / local-first
- Obsidian compatibility
- No ongoing costs

**What ClawVault should adopt from Graphiti:**
1. **Dynamic context injection** (Phase 1 — days)
2. **Temporal search weighting** (Phase 1 — days)
3. **Multi-agent shared vault** (Phase 2 — weeks)
4. **Fact supersession** (Phase 2 — weeks)
5. **Optional Graphiti sync** (Phase 3 — months)

**The goal:** Make ClawVault the best single-agent memory system while optionally integrating with Graphiti for multi-agent deployments. Keep the local-first, zero-cost, Obsidian-compatible philosophy as the core differentiator.

---

*"An elephant never forgets — and now neither do your agents."* 🐘
