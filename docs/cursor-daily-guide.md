# Cursor daily guide, Edgeways harness

The one-page reference for working on Edgeways in Cursor: what fires on its own,
what to invoke, and how the quality gates fit together. For setup see
`docs/cursor-setup.md`; for the full harness map see `docs/cursor-kit.md`; for
cross-editor habits see `docs/ai-playbook.md`.

## The 60-second version

**Fires automatically (no action needed):**

- `AGENTS.md` (root + `edgeways/`) — read at session start.
- Rules in `edgeways/.cursor/rules/*.mdc` — attach when you touch matching files
  (`design-system.mdc` and `micro-typography.mdc` on UI, `calc-guardrails.mdc` on calc).
- Root rules in `.cursor/rules/` — always on (`model-routing`, `dev-server`).
- Skills in `.cursor/skills/` — trigger from their descriptions when your request
  matches (e.g. UI work pulls in the design skills).

**You invoke:**

- Slash commands (type `/` in chat): `/calc-change`, `/calc-audit`, `/brief`,
  `/delegate-local`, `/design-review`.
- Subagents: ask in chat, e.g. "delegate this diff to the calc-auditor".

**The two rules that outrank everything:**

1. Calc or settlement change → `/calc-change` workflow + `calc-auditor` before commit. No exceptions.
2. UI change → `edgeways/docs/design-system.md` is law. Everything else defers to it.

## Where everything lives

| What                 | Path                                          | Purpose                                          |
| -------------------- | --------------------------------------------- | ------------------------------------------------ |
| Source of truth (UI) | `edgeways/docs/design-system.md`              | Tokens, patterns, voice. Law.                    |
| Auto-attach rules    | `edgeways/.cursor/rules/`                     | design-system, micro-typography, calc-guardrails |
| Always-on rules      | `.cursor/rules/`                              | model-routing, dev-server                        |
| Skills               | `.cursor/skills/` (mirror: `.claude/skills/`) | Workflows that shape the build                   |
| Subagents            | `.cursor/agents/` (mirror: `.claude/agents/`) | Read-only quality gates                          |
| Slash commands       | `.cursor/commands/`                           | Manual triggers for the above                    |
| Harness map          | `docs/cursor-kit.md`                          | How the kit fits together                        |
| Model strategy       | `docs/Local-vs-Cloud-Model-Strategy.md`       | Why/when of model routing                        |

## The three daily loops

### 1. Money-maths change (calc, settlement, offers)

1. `/calc-change` (or let the skill fire) — test-first, hand-worked numbers.
2. Smallest diff via `src/lib/calc/money.ts`. Never touch `ep/engine.ts` combinatorics.
3. `npx vitest run` from `edgeways/` stays green. Never weaken a test.
4. "Delegate this diff to the calc-auditor" — on a frontier model.
5. Fix any FAILs, then commit.

### 2. UI change (screens, components)

1. Skills shape the build automatically: `design-system-consistency`,
   `design-taste`, `ux-heuristics`. If they don't fire, read them manually.
2. Build with tokens, shadcn primitives, documented patterns. Five states on
   every data view (loading / empty / ideal / error / overflow).
3. Self-verify with the `visual-qa-loop` skill: screenshots at 375 / 768 / 1440,
   real interactions, clean console.
4. Gates before commit: `consistency-checker` (cheap background drift check) then
   `design-reviewer` (judgement). `/design-review` invokes the latter.
5. Fix Blockers and Majors, then commit.

### 3. Roadmap item

1. `/brief` — produces a self-contained work order sized `[local]` / `[strong]` / `[design-first]`.
2. `[local]` → `/delegate-local` ships it to the Ollama backbone; review like a junior's PR.
3. `[strong]` → in-session on a frontier model.
4. `[design-first]` → wait for Sam's mock before building UI.

## Cheat sheets

### Slash commands

| Command           | Use when                                                |
| ----------------- | ------------------------------------------------------- |
| `/calc-change`    | Touching anything in `src/lib/calc` or `src/lib/offers` |
| `/calc-audit`     | Before committing a calc diff (frontier model)          |
| `/design-review`  | Before committing a UI diff (frontier model)            |
| `/brief`          | Turning a roadmap item into a work order                |
| `/delegate-local` | Bounded mechanical task for the local 30B node          |

### Subagents (read-only, they report, never edit)

| Agent                 | Model                  | Job                                               |
| --------------------- | ---------------------- | ------------------------------------------------- |
| `calc-auditor`        | inherit (use frontier) | Money-maths diffs: tests, exactness, spec-lock    |
| `design-reviewer`     | inherit (use frontier) | Design-system conformance + design quality        |
| `consistency-checker` | fast, background       | Mechanical drift: tokens, shadcn, utilities, copy |
| `ux-qa-auditor`       | inherit                | Flows, states, forms, keyboard/a11y, resilience   |

### Skills (auto-triggering workflows)

| Skill                       | Shapes                                                  |
| --------------------------- | ------------------------------------------------------- |
| `calc-change`               | Guarded calc workflow                                   |
| `brief`                     | Implementation briefs                                   |
| `delegate-local`            | Local-backbone delegation                               |
| `design-system-consistency` | UI at write time: tokens, patterns, reuse               |
| `design-taste`              | Anti-generic judgement, subordinate to design-system.md |
| `ux-heuristics`             | Interaction quality: states, forms, a11y                |
| `visual-qa-loop`            | Screenshot verification before "done"                   |

### Model routing (quick version)

| Job                                  | Lane                                          |
| ------------------------------------ | --------------------------------------------- |
| Routine cloud agent                  | Composer 2.5 / Grok 4.5                       |
| Serious multi-file run               | Kimi K3                                       |
| Calc review, hard bugs, architecture | Claude Opus 5 / Fable 5                       |
| Bounded mechanical edits             | Local `qwen3-coder-ctx` via `/delegate-local` |

Full matrix: `docs/Local-vs-Cloud-Model-Strategy.md`.

## Automations: the systematic auto-\* layer

The harness is already automation-shaped. The mapping:

| Harness piece                | Automation role                                                                |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Skills                       | Standard operating procedures the agent follows                                |
| Subagents                    | Quality gates (read-only, report-only)                                         |
| Slash commands               | Manual triggers                                                                |
| Hooks (`.cursor/hooks.json`) | Local enforcement on agent events                                              |
| Cursor Automations           | Cloud agents on schedules / events (repo is on GitHub: `EdgeDesk-MB/EdgeDesk`) |
| Connected MCPs               | Linear (ticketing), PostHog (product analytics), Supabase, Stripe              |

### Recipe 1: Feedback → Linear triage

The app already collects feedback locally: `/feedback` page →
`src/app/api/feedback/route.ts` → `feedback_reports` table (kind, summary,
details, diagnostics, created\_at). The data lives in local SQLite, so the triage
loop runs where the data is:

- **Near term (local):** a scheduled in-session triage — \`/loop 1d read new
  feedback\_reports rows, dedupe against existing Linear issues, draft tickets\` —
  or a small local script on launchd/cron that reads the DB and calls the Linear
  API. Sam approves each ticket before it is created.
- **Later (hosted):** if feedback gains a reachable endpoint, a Cursor Automation
  on a webhook or daily cron does the same in the cloud with the Linear MCP.

Ticket shape: kind → Linear label (bug/idea/other), summary → title, details +
diagnostics (app version, page, UA) → body, `feedback_reports.id` in the issue
for idempotency (never file the same row twice).

### Recipe 2: Local quality gates via hooks

Hooks run on agent events and need no cloud. Candidates:

- `afterFileEdit` matching `src/lib/calc/**` or `src/lib/offers/**` → inject a
  reminder: run `/calc-change` checks and delegate to `calc-auditor` before commit.
- `afterFileEdit` matching `src/app/**` / `src/components/**` → remind:
  design-system.md conformance, five states, visual-qa-loop before "done".
- `stop` → if the diff touched calc, check a vitest run happened this session.

Ask for these in chat ("create a project hook that…") and they get written to
`.cursor/hooks.json` + `.cursor/hooks/`, checked into the repo.

### Recipe 3: Scheduled drift and QA sweeps (cloud, cron)

- **Nightly:** consistency-checker sweep over the day's diff on `main` → report,
  no edits. Catches drift that slipped past the build-time skills.
- **Weekly:** ux-qa-auditor over the most-changed screens → findings report.
- **Weekly:** design-debt digest — token gaps and "design-system.md update
  needed: yes" findings collected into one Linear issue.

### Recipe 4: Errors → tickets

PostHog MCP is connected. A scheduled run groups new errors, pairs each with a
suspect commit, and drafts a Linear issue with repro context. Same idempotency
rule: one Linear issue per error group, linked both ways.

### Recipe 5: PR gates (when PRs enter the workflow)

Git triggers exist (PR opened, pushed, merged). When Edgeways moves to a
PR-based flow: PR opened → calc-auditor prompt on the diff if calc paths
touched, design-reviewer prompt if UI paths touched, results posted as a PR
comment. The agents' prompts already exist; the automation just runs them.

### Automation principles (hold these regardless of recipe)

1. **Gates stay read-only.** Automations report and draft; humans (or a gated
   session) apply. The subagent prompts already enforce this.
2. **Human approval first.** Ticket creation starts as draft-and-approve; only
   promote to fully automatic once the false-positive rate is boring.
3. **Idempotent always.** Every automation records what it has already processed
   (feedback id, error group, commit SHA) and never double-acts.
4. **Budget aware.** Cloud automations consume compute; fast models for sweeps,
   frontier models only where judgement is the point (calc, design verdicts).
5. **Logged.** Every run leaves a trail (Linear comment, report file, or PR
   comment) so failures are auditable.

## Keeping the harness healthy

- **Mirror rule:** `.cursor/skills|agents` and `.claude/skills|agents` carry the
  same content with different frontmatter. Change one, sync the other.
- **design-system.md is law.** When the system changes, update the doc first,
  then the code. Skills and agents already defer to it.
- **Adding a piece:** new workflow → `.cursor/skills/<name>/SKILL.md` (+ mirror);
  new gate → `.cursor/agents/<name>.md` (+ mirror); new manual trigger →
  `.cursor/commands/<name>.md`. Then add a row to `docs/cursor-kit.md` and this
  guide.
- **Rules vs skills:** always-on conventions belong in `.cursor/rules/`; task
  workflows belong in skills. Do not blur them.

## Doc map

| Doc                                     | Read when                                                   |
| --------------------------------------- | ----------------------------------------------------------- |
| This file                               | Daily reference                                             |
| `docs/live-readiness.md`                | Launch path: automations, payments, legal, pre-launch gates |
| `docs/cursor-kit.md`                    | Harness structure and port notes                            |
| `docs/cursor-setup.md`                  | One-off Cursor configuration                                |
| `docs/ai-playbook.md`                   | Habits across Cursor, Zed, Claude Code                      |
| `docs/Local-vs-Cloud-Model-Strategy.md` | Model routing why/when                                      |
| `edgeways/docs/design-system.md`        | Before any UI work                                          |
| `edgeways/AGENTS.md`                    | Product context, hard rules, pre-flight                     |
