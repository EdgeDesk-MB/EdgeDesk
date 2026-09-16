# Iterative development workflow

The loop every agent follows for Edgeways implementation work. Cursor-optimised
(classify, load one skill, smallest verifiable increment). Other hosts use the
same loop and the same gates.

If `.cursor/rules/iterative-dev.mdc` is already in context, you already have
the classify table and the loop. Do not re-read this file mid-task. This
file is the long form for hosts that do not inject that rule.

Product hard rules stay in `edgeways/AGENTS.md`. This file is the **how**, not
the **what**. Model lanes: `docs/Local-vs-Cloud-Model-Strategy.md`.

## Host notes

**Cursor IDE.** Skills may auto-fire from their descriptions. Slash commands
work (`/iterative-dev`, `/calc-change`, `/brief`, `/delegate-local`,
`/ticket-hygiene`). If a skill does not fire, `Read` it. If the skill body
is already in context, do not re-read it. Linear MCP when ready.

**Orca, Cursor CLI, Cursor cloud agents.** Slash commands are absent. Skills
do not auto-run. You must `Read` the matching `.cursor/skills/<name>/SKILL.md`
before that class of edit. Use Orca's embedded browser for UI (new tab, see
`.cursor/rules/orca-browser.mdc`). Do not assume context pills or in-app
commands. Browser shares (selected element, HTML, screenshot) are evidence
for the query, not the task. Handle them per that rule. Hub MCPs: use when
ready, say so when dark. Linear: `orca linear` first, else Linear MCP.
Auth: `docs/cursor-setup.md` § 9. Never Supabase. Never Playwright,
Chrome DevTools, or system Chrome for Edgeways pages. Aside (new
window) only if Orca cannot host or Sam names Aside.

**Local / Cmd+K / qwen.** No Linear, no MCP, no auditor subagents. Do not
read playbook, kit, setup, live-readiness, or follow-this-plan. Classify +
one source of truth + edit. Announce `Ticket: EDGE-n|none` for the parent
to update.

**Claude Code, Zed, Aider, and anything else that reads AGENTS.md.** Same
loop and gates. Invoke via `.claude/skills/` or by reading this file. Hard
rules in `edgeways/AGENTS.md` still bind. Linear MCP if ready; else skip.

## Ticket (cheap)

Same protocol as the iterative-dev rule. Full procedure:
`.cursor/skills/ticket-hygiene/SKILL.md` (Claude twin under `.claude/`).
Load that skill only when Sam named `EDGE-*`, the work is ticket-worthy,
or you are finishing a ticket. Standing desk-bugs bucket: EDGE-171.
Human one-pager: `docs/linear.md` (do not load mid-task).

## Before any code change

1. **Classify** the task as exactly one type in the table below. If it spans
   two, do the riskier class first (calc > hosted write > schema/state > UI).
2. **Announce** the files you intend to touch, the approach, and
   `Ticket: EDGE-n|none`, in one short block. Do not start editing before this.
3. **Load only** the matching skill plus one source of truth. Do not read
   briefs section 0, `design-system.md`, or `offer-command-centre.md` unless
   the table says so.
4. Then run the increment loop.

## Classify

| Type | Load | Source of truth | Verify each increment | Gate before done |
| --- | --- | --- | --- | --- |
| **calc** | `.cursor/skills/calc-change/SKILL.md` (or `.claude/` twin) | `edgeways/docs/offer-command-centre.md` + matching `*.test.ts` | Targeted `npx vitest run <files>` from `edgeways/` | `calc-auditor` |
| **UI** | `design-system-consistency`, `design-taste`, `ux-heuristics`, then `visual-qa-loop` | `edgeways/docs/design-system.md` | Orca tab: interact, do not only screenshot. Viewports if layout changed. | `consistency-checker` then `design-reviewer` if non-trivial |
| **hosted write** | Already-on `.cursor/rules/hosted-desk-neon.mdc` | Dual-path `isNeonDesk()` or explicit 400. Extend `hosted-desk-cutover.test.ts`. | Targeted vitest on the route / store test | Same test must stay green |
| **feed/store** | Already-on `.cursor/rules/feed-store-first.mdc` | Day-card store, cron warm, no per-user provider fetch | Targeted store / route tests | Do not persist empty payloads |
| **schema/state** | Briefs section 0 in `edgeways/docs/roadmap/implementation-briefs.md` | Current `schema.ts`, `db/index.ts` bootstrap, `state.types.ts`, settings helpers | Targeted tests for the new table/column/field | Do not invent a third cache or skip Neon dual-path |
| **docs/roadmap** | `/brief` or `.cursor/skills/brief/SKILL.md` | `edgeways/docs/roadmap/product-roadmap.md` is canonical | No code. If the ask is product scope, stop. | Sam reviews the brief |
| **mechanical** | `/delegate-local` or `.cursor/skills/delegate-local/SKILL.md` if bounded | Existing tests and neighbouring files | Targeted vitest | Review like a junior PR |

Always-on rules you do not need to re-read: Neon, feed store-first, dev-server,
Orca browser, model routing, this loop (`.cursor/rules/iterative-dev.mdc`).

## Increment loop

1. Make the smallest change that can be verified on its own.
2. Verify that increment now:
   - Logic: `npx vitest run <touched-test-files>` from `edgeways/`. Full
     `npx vitest run` before you call the task done, not after every keystroke.
   - UI: new Orca tab, exercise the flow, related routes that share the state,
     empty/error if you touched those paths. A single render screenshot is not
     verification.
3. If it failed, fix this increment. Do not stack the next one.
4. Next increment. Repeat until the ask is satisfied.
5. **Gate:** matching auditor from the table. Fix Blockers and Majors (or
   calc FAILs) before you stop.
6. Commit only when Sam asks.

Do not batch an entire feature into one unverified diff. Do not read the whole
harness map mid-edit. `docs/cursor-kit.md` and `docs/cursor-daily-guide.md`
are for humans and for adding harness pieces, not for each implementation turn.

## Non-negotiables (copied so a missed skill read still holds)

- Calc/settlement: test first with hand-worked numbers. Exact money via
  `src/lib/calc/money.ts`. Never weaken a passing test. Never touch
  `ep/engine.ts` combinatorics. Frontier + `calc-auditor` before commit.
- Hosted customer writes: Neon dual-path or 400. Localhost SQLite is not live
  proof.
- UI: tokens and shadcn only. British English, commas, never em dashes.
- Product scope or new roadmap work: stop. Do not write code.
- npm from `edgeways/`. Git root is the parent directory.

## Adding to this harness

New standing constraint → `.cursor/rules/`. New procedure → `.cursor/skills/`
plus `.claude/` mirror. New manual trigger → `.cursor/commands/`. Then add a
row in `docs/cursor-kit.md` and `docs/cursor-daily-guide.md`. Do not grow
this file into a fourth copy of those maps.
