# MB app build, repo map

Git root is THIS directory. The product is EdgeDesk, a local-first matched
betting command centre, and it lives entirely in `edgedesk/` (Next.js 16 app).

Before doing any work:
1. Read `edgedesk/AGENTS.md`. It holds the product context, hard rules and the
   mandatory pre-flight checklist.
2. For repo conventions (git paths, tests, DB bootstrap, data shapes), read
   section 0 of `edgedesk/docs/roadmap/implementation-briefs.md`.

The browser extension (J9 betslip fill) lives in `extension/` — plain Chrome
MV3, no build step; see `extension/README.md` for the install and the manual
test protocol.

Other pointers:
- Model routing strategy (local Ollama backbone vs cloud frontier):
  `docs/Local-vs-Cloud-Model-Strategy.md`.
- Claude Code skills and subagents: `.claude/skills/`, `.claude/agents/`.
- Run all npm commands from `edgedesk/`, not from this directory.
