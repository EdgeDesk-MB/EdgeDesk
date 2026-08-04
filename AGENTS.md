# MB app build, repo map

Git root is THIS directory. The product is Edgeways, a local-first matched
betting command centre, and it lives entirely in `edgeways/` (Next.js 16 app).

Before doing any work:
1. Read `edgeways/AGENTS.md`. It holds the product context, hard rules and the
   mandatory pre-flight checklist.
2. For repo conventions (git paths, tests, DB bootstrap, data shapes), read
   section 0 of `edgeways/docs/roadmap/implementation-briefs.md`.

The browser extension (J9 betslip fill) lives in `extension/` — plain Chrome
MV3, no build step; see `extension/README.md` for the install and the manual
test protocol.

Other pointers:
- Model routing strategy (local Ollama backbone vs Cursor Ultra / Claude Code):
  `docs/Local-vs-Cloud-Model-Strategy.md`. Day-to-day habits: `docs/ai-playbook.md`.
  Enable-list: `docs/cursor-setup.md`. Always-on rule: `.cursor/rules/model-routing.mdc`.
- Claude Code skills and subagents: `.claude/skills/`, `.claude/agents/`.
- Run all npm commands from `edgeways/`, not from this directory.

## Model routing (agents)

You cannot switch the user's model picker. For non-trivial work, if the current
model is a poor fit, say so briefly once and recommend a lane:

| Lane | Models | Use for |
| --- | --- | --- |
| Local | `qwen3-coder-ctx` | Bounded edits, privacy, unlimited grind |
| Cursor Models | Composer 2.5, Grok 4.5 | Default daily cloud agents (protect Other Models $) |
| Volume frontier | Kimi K3 | Serious multi-file Cursor agent runs |
| Peak | Claude Opus 5 / Fable 5 | Architecture, hard bugs, calc review, prose |
| Specialist harness | Claude Code + Opus | Long autonomous explore → edit → test loops |

Hard rules: calc/settlement changes need frontier + `/calc-change` + audit, never
local-unreviewed. Prefer Composer/Grok over K3/Opus when the task is routine.
