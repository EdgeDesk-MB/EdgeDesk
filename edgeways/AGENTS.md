<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Edgeways, agent instructions

Local-first matched betting command centre. Answers three daily questions:
"what next?", "am I executing correctly?", "did it actually pay?".
Next.js 16 (App Router), TypeScript, SQLite (better-sqlite3 + Drizzle) at
data/edgeways.db, shadcn/ui + NumberFlow + Liveline. Pure calc engine in
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
- Hosted desk is Neon. Vercel SQLite is `:memory:`. Never ship a customer
  mutation that writes SQLite on `isNeonDesk()`. Dual-path or return 400.
  `hosted-desk-cutover.test.ts` must stay green. Localhost success is not
  live proof. Production is the live app (`SITE_SURFACE=app`).
- Sport day-cards are store-first (`racecard-store`, `fixture-store`). Cron
  warms today/tomorrow; desks read Edgeways, not the provider. New sports
  copy that shape. See `../.cursor/rules/feed-store-first.mdc`.
- NEVER weaken or delete a passing calc/settlement test to make code pass.
- Money maths is exact: no floating-point shortcuts in stake/lay/commission logic.
- Respect the result-centric model: derive market outcomes, do not hardcode them.
- Follow the existing design tokens and shadcn patterns. No ad-hoc colours.
- Do NOT refactor `src/lib/calc/ep/engine.ts` (spec-locked, see file header).
  Adding consumers is fine; changing combinatorics or normalisation is not.
- Git root is the PARENT directory (`MB app build/`). Run all npm commands from
  `edgeways/`.

## Do NOT build (deferred by design)
- No arbitrage or Kelly criterion features.
- No web scraping of bookmakers/odds.
- No oddsmatching or offer discovery (D2). The Match Checker checks a match you
  found; the moment it browses or ranks markets, it is an oddsmatcher.
- No Tauri packaging yet.
- No customer API-key fields, ever. Feeds are operator-held (D7), never BYOK.
- No heavy OCR beyond the existing bet-slip import.
- Do not add dependencies without flagging them first.

**Auth and multi-tenant are shipped, not deferred.** This list previously said
"No auth, multi-tenant, or Tauri packaging yet". Clerk auth and the hosted Neon
per-user desk (Route 1, D6) went live in August 2026 and production has been
charging customers since 4 Sep 2026. Corrected 13 Sep 2026.

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm run test` (full run: `npx vitest run`)
- Lint: `npm run lint`

## Where things live
- Calc engine: `src/lib/calc`
- Offers logic: `src/lib/offers` (advantage.ts, do-next.ts)
- Roadmap data: `src/content/roadmap.ts`
- Product plan: `docs/roadmap/product-roadmap.md` is **canonical**; it wins over
  any older doc. Briefs: `docs/roadmap/implementation-briefs.md`. Origin context
  only: `../docs/PLAN.md`. Strategy research lives in parent `../docs/strategy/`,
  see `../docs/repo-layout.md`. Launch and ops: `../docs/live-readiness.md`.
- Design system: `docs/design-system.md`
- Lay odds / lay stake fields: `src/lib/calc/exchange-odds-step.ts` and
  `src/lib/calc/exchange-stake-step.ts`. Arrows, chevron steppers, and
  the wheel follow the exchange ladder (`useNonPassiveWheel` +
  `handleExchangeOddsInputEvent`). Typed lay odds stay as entered (do
  not snap on blur). Rule: `.cursor/rules/lay-fields.mdc`.
- Alert quieting: `src/lib/services/quiet-alerts.ts` (server-only). Dedupe keys
  live in `src/lib/alerts/expiring-alert-keys.ts`. Never import quiet-alerts
  from `free-bet-lots` or other `/api/state` graph modules. Call `quiet*` from
  the mutation API.

## Skills, subagents and delegation
Harness at the git root: Cursor reads `../.cursor/` (skills, agents, commands);
Claude Code reads `../.claude/` (same content, mirrored). Map: `../docs/cursor-kit.md`.
- `/calc-change`: guarded workflow for any change to calc/settlement maths.
- `/brief`: turn a roadmap item into an implementation brief in the
  `docs/roadmap/implementation-briefs.md` format, sized [local]/[strong]/[design-first].
- `/delegate-local`: hand bounded, mechanical tasks to the local Ollama backbone.
- Subagents: `calc-auditor`, `design-reviewer`, `consistency-checker`, `ux-qa-auditor`.
- UI skills (auto-triggered): `design-system-consistency`, `design-taste`,
  `ux-heuristics`, `visual-qa-loop`.
- Model routing: `../docs/Local-vs-Cloud-Model-Strategy.md`, playbook
  `../docs/ai-playbook.md`, always-on rule `../.cursor/rules/model-routing.mdc`.

## Model routing (agents)

You cannot switch the user's model picker. For non-trivial Edgeways work, if
the current model is a poor fit, say so briefly once and recommend:

- **Composer 2.5 / Grok 4.5** — routine cloud agent (Cursor Models pool).
- **Kimi K3** — serious multi-file agent runs.
- **Claude Opus 5 / Fable 5** — architecture, hard bugs, calc review, prose.
- **Claude Code + Opus** — long autonomous harness loops.
- **Local `qwen3-coder-ctx`** — bounded edits when the Ollama bridge is up.

Calc/settlement: frontier + `/calc-change` + audit only. Prefer Composer/Grok
over K3/Opus when the task is routine so Other Models budget lasts.
