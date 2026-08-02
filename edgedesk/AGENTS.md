<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# EdgeDesk, agent instructions

Local-first matched betting command centre. Answers three daily questions:
"what next?", "am I executing correctly?", "did it actually pay?".
Next.js 16 (App Router), TypeScript, SQLite (better-sqlite3 + Drizzle) at
data/edgedesk.db, shadcn/ui + NumberFlow + Liveline. Pure calc engine in
src/lib/calc (Vitest-tested). Result-centric: record the real-world outcome,
the app derives every market and auto-settles linked bets.

## Pre-flight (MANDATORY before any code change)
1. List the files you intend to touch and the approach, in one short block.
2. Read section 0 ("Repo conventions") of `docs/roadmap/implementation-briefs.md`
   before your first change in a session.
3. If the task touches calculations or settlement, read `docs/offer-command-centre.md`
   and the relevant `src/lib/calc/*.test.ts` FIRST. Never change calc output
   without adding/adjusting a test.
4. If the task touches UI, read `docs/design-system.md` first.
5. If the task is product scope or roadmap, STOP and defer to the planning flow.
   Do not write code.
6. Implement the smallest diff that satisfies the task.

## Hard rules
- British English. Commas, never em dashes.
- NEVER weaken or delete a passing calc/settlement test to make code pass.
- Money maths is exact: no floating-point shortcuts in stake/lay/commission logic.
- Respect the result-centric model: derive market outcomes, do not hardcode them.
- Follow the existing design tokens and shadcn patterns. No ad-hoc colours.
- Do NOT refactor `src/lib/calc/ep/engine.ts` (spec-locked, see file header).
  Adding consumers is fine; changing combinatorics or normalisation is not.
- Git root is the PARENT directory (`MB app build/`). Run all npm commands from
  `edgedesk/`.

## Do NOT build (deferred by design)
- No arbitrage or Kelly criterion features.
- No web scraping of bookmakers/odds.
- No auth, multi-tenant, or Tauri packaging yet.
- No heavy OCR beyond the existing bet-slip import.
- Do not add dependencies without flagging them first.

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm run test` (full run: `npx vitest run`)
- Lint: `npm run lint`

## Where things live
- Calc engine: `src/lib/calc`
- Offers logic: `src/lib/offers` (advantage.ts, do-next.ts)
- Roadmap data: `src/content/roadmap.ts`
- Product vision: `PLAN.md`, `docs/roadmap/`
- Design system: `docs/design-system.md`

## Skills, subagents and delegation (Claude Code)
Project skills and subagents live in `../.claude/` at the git root.
- `/calc-change`: guarded workflow for any change to calc/settlement maths.
- `/brief`: turn a roadmap item into an implementation brief in the
  `docs/roadmap/implementation-briefs.md` format, sized [local]/[strong]/[design-first].
- `/delegate-local`: hand bounded, mechanical tasks to the local Ollama backbone.
- Subagents: `calc-auditor` (audits money-maths diffs before commit) and
  `design-reviewer` (checks UI diffs against the design system).
- Model routing: `../docs/Local-vs-Cloud-Model-Strategy.md`, playbook
  `../docs/ai-playbook.md`, always-on rule `../.cursor/rules/model-routing.mdc`.

## Model routing (agents)

You cannot switch the user's model picker. For non-trivial EdgeDesk work, if
the current model is a poor fit, say so briefly once and recommend:

- **Composer 2.5 / Grok 4.5** — routine cloud agent (Cursor Models pool).
- **Kimi K3** — serious multi-file agent runs.
- **Claude Opus 5 / Fable 5** — architecture, hard bugs, calc review, prose.
- **Claude Code + Opus** — long autonomous harness loops.
- **Local `qwen3-coder-ctx`** — bounded edits when the Ollama bridge is up.

Calc/settlement: frontier + `/calc-change` + audit only. Prefer Composer/Grok
over K3/Opus when the task is routine so Other Models budget lasts.
