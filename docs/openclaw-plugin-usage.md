# OpenClaw Migration Guide

ClawVault is deprecated as the recommended memory path for OpenClaw.

OpenClaw now has a first-party memory stack with official docs, builtin memory, and a maintained QMD backend. For new deployments, use OpenClaw native memory instead of installing ClawVault as a plugin.

- [Memory Overview](https://docs.openclaw.ai/concepts/memory)
- [Builtin Memory Engine](https://docs.openclaw.ai/concepts/memory-builtin)
- [QMD Memory Engine](https://docs.openclaw.ai/concepts/memory-qmd)

## Why this changed

ClawVault got to this shape early.

It helped prove that markdown-native structured memory could work well in practice, especially with:

- local, human-readable memory files
- Obsidian-friendly workflows
- QMD-style local retrieval for stronger recall

Those ideas are now part of OpenClaw's official, maintained memory story. OpenClaw's memory docs and QMD backend are the path that should move forward.

## Recommendation

### New deployments

Choose OpenClaw native memory.

Do not start a new OpenClaw install by wiring in ClawVault unless you are deliberately maintaining an older setup.

### Existing ClawVault users

If your current setup works, you do not need to panic-migrate immediately. But you should treat ClawVault as legacy integration and plan to move onto OpenClaw's first-party memory stack.

## Migration direction

The usual mapping is straightforward:

| ClawVault concept | OpenClaw path |
|---|---|
| ClawVault plugin as memory layer | OpenClaw builtin memory or QMD backend |
| Vault-backed memory workflow | `MEMORY.md`, `memory/YYYY-MM-DD.md`, and OpenClaw memory tooling |
| QMD-style retrieval via ClawVault-era setup | OpenClaw's maintained [QMD Memory Engine](https://docs.openclaw.ai/concepts/memory-qmd) |
| OpenClaw memory entrypoint questions | [Memory Overview](https://docs.openclaw.ai/concepts/memory) |

## What to read now

Start with the official OpenClaw docs:

1. [Memory Overview](https://docs.openclaw.ai/concepts/memory)
2. [Builtin Memory Engine](https://docs.openclaw.ai/concepts/memory-builtin)
3. [QMD Memory Engine](https://docs.openclaw.ai/concepts/memory-qmd)

Use builtin memory when you want the default, supported path with no extra sidecar.

Use QMD when you want local-first retrieval with reranking, query expansion, transcript indexing, or extra indexed paths.

## Practical migration notes

- Prefer OpenClaw's native memory files and tools as the source of truth going forward.
- Move any new setup or documentation toward OpenClaw memory concepts, not ClawVault plugin registration.
- If you relied on ClawVault mainly for markdown-native memory plus local retrieval, OpenClaw now covers that directly.
- If you relied on Obsidian-friendly file workflows, keep the file-oriented workflow, but migrate the runtime integration to OpenClaw's memory stack.

## Historical note

ClawVault was useful because it arrived before the official path existed. It helped establish the shape of markdown-native structured memory in the OpenClaw ecosystem.

That is worth preserving. It is also why this repository now points new users to OpenClaw first.
