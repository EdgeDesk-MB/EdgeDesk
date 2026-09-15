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
1. If the iterative-dev rule is already in context, follow its classify
   table. Do not re-read this pre-flight as a second loop. Hosts without
   that rule: read `../docs/cursor-workflow.md`.
2. Announce files, approach, and `Ticket: EDGE-n|none` in one short block.
3. Load only the matching skill plus one source of truth from that table.
   Do not open design-system, briefs section 0, or offer-command-centre
   unless the table says so.
4. If the task is product scope or roadmap, STOP and defer to the planning
   flow. Do not write code.
5. Smallest verifiable increment, then the next. Do not batch an
   unverified feature.

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
- UI verify is Orca's embedded browser (`orca tab create`). Aside (new
  window) only if Orca cannot host or Sam names Aside. Never Playwright,
  Chrome DevTools, system Chrome, or Computer Use for desk pages.

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
Implementation loop: already-on `../.cursor/rules/iterative-dev.mdc`, or
`../docs/cursor-workflow.md` if that rule is not in context. If skills did
not auto-fire (Orca, CLI, cloud agents), `Read` the matching `SKILL.md`.
Local / Cmd+K / qwen: no Linear, no MCP, no auditor subagents.

Harness at the git root: Cursor reads `../.cursor/` (skills, agents, commands);
Claude Code reads `../.claude/` (same content, mirrored). Map: `../docs/cursor-kit.md`.
- `/iterative-dev`: classify → load one skill → increment → verify.
- `/ticket-hygiene`: Linear only when a ticket applies (not always-on).
- `/calc-change`: guarded workflow for any change to calc/settlement maths.
- `/brief`: turn a roadmap item into an implementation brief in the
  `docs/roadmap/implementation-briefs.md` format, sized [local]/[strong]/[design-first].
- `/delegate-local`: hand bounded, mechanical tasks to the local Ollama backbone.
- Subagents: `calc-auditor`, `design-reviewer`, `consistency-checker`, `ux-qa-auditor`.
- UI skills: `design-system-consistency`, `design-taste`, `ux-heuristics`,
  `visual-qa-loop`.
- Model routing: `../docs/Local-vs-Cloud-Model-Strategy.md`. Playbook:
  `../docs/ai-playbook.md`. Always-on: `../.cursor/rules/model-routing.mdc`.
  Prefer Composer/Grok for routine work. Calc/settlement: frontier +
  `/calc-change` + audit only.
