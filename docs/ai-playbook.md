# AI stack playbook

**Updated:** 2 August 2026  
**Scope:** how to actually drive the stack day to day. Routing analysis and
subscription strategy live in `docs/Local-vs-Cloud-Model-Strategy.md`. Cursor
enable-list and one-off setup live in `docs/cursor-setup.md`.

Note: app UI details (menu names, shortcuts) drift between versions. Where a
shortcut below is wrong, the in-app command palette or help is the truth.

---

## Home base

**Cursor Ultra is home base:** read code, lean on the index, multi-model agents,
visual diffs. Claude Code is the specialist for long autonomous or guarded
loops (terminal or Claude Code side panel). Zed remains the speed tool for
local ghost text. Local Ollama is the unlimited backbone for bounded edits.

Kimi K3 is a strong cheap daily cloud agent, not the peak standard. Peak work
still goes to Claude Opus/Fable (Cursor or Claude Code). Protect the Other
Models pool by using Grok 4.5 / Composer 2.5 for routine cloud sessions.

## TL;DR routing

| Job | Open | Model |
| --- | --- | --- |
| Ghost text / autocomplete | Zed | `bb-qwen-14b` (already default) |
| Quick bounded edit, one file | Cursor Cmd+K or Zed inline | `qwen3-coder-ctx` |
| Daily feature / agent work | Cursor agent | **Composer 2.5 / Grok 4.5** (Cursor Models pool) |
| Serious multi-file agent run | Cursor agent | **Kimi K3** |
| Architecture, 10+ files, migrations | Cursor agent or Claude Code | **Opus 5 / Fable 5** |
| Long autonomous "finish this" | Claude Code | Opus / Fable |
| Anything touching calc/settlement maths | `/calc-change` | frontier only, audited before commit |
| Product thinking, decompositions | Zed agent or Cursor chat | `qwen3:30b-thinking` or Claude |
| Briefs, roadmap docs | `/brief` | frontier |
| Stakeholder-facing writing | Claude | Opus / Fable |
| Bulk mechanical transforms | Claude Code `/delegate-local` | foreman → Ollama |
| Review before commit | `/calc-audit`, `/design-review`, Claude `/code-review` | frontier |

## Golden rules

1. **Open `MB app build/` (git root) as the workspace** in every app. That is
   where AGENTS.md, rules and skills are discovered from.
2. **Money maths is frontier-reviewed, always.** Local models may draft, but
   nothing that changes calc/settlement output lands without the `/calc-change`
   workflow plus an audit pass (`calc-auditor` or `/code-review` in Claude Code,
   `/calc-audit` in Cursor). A wrong test is worse than a bug.
3. **Protect Other Models spend.** Default cloud agents to Composer/Grok;
   escalate to K3, then Opus. Local drafts + cloud reviews stays the cheap
   quality pattern.
4. **Two strikes then escalate** (except money maths: escalate on task type).
5. **Trust rules, verify claims.** Local models obey injected rules but
   over-extrapolate (see the `matched.ts` "missing test file" incident,
   13 July 2026). Treat factual claims as unverified until checked.
6. **Wrong model for the job?** Agents should say so at the start of a turn
   (see `.cursor/rules/model-routing.mdc` and root `AGENTS.md`). Cursor does
   not auto-switch the picker; you change it.

---

## Cursor

Best for: multi-model IDE work, visual diffs, day-to-day agents. Setup:
`docs/cursor-setup.md`.

### The three surfaces
- **Tab (ghost text):** Cursor's proprietary model only; it cannot use your
  local models. If you want local ghost text, that is Zed's job.
- **Inline edit (Cmd+K):** bounded, single-file edits. Local models via picker
  work well with `qwen3-coder-ctx`.
- **Chat / Agent:** multi-file work. Model picker on the input. Prefer
  Composer/Grok for routine sessions; K3 for serious agents; Opus for peak.

### Model ladder (cloud)
`Composer / Grok` → `Kimi K3` → `Sonnet 5` → `Opus 5 / Fable 5`  
Local parallel ladder: `qwen3-coder-ctx` → `bb-deepseek-70b` → escalate cloud.

### Context, the @ menu
- `@file` / `@folder`: pin exactly what the model needs. Keep pinned context
  small for local models (32–64K practical).
- `@Docs`: Next.js 16 docs URL once, then reference (local models have stale
  Next training data).
- `@web`: cloud models only.
- `.cursorignore` keeps `eng.traineddata` and `package-lock.json` out of context.

### Rules
`edgedesk/.cursor/rules/*.mdc` auto-attach on matching files. Root
`.cursor/rules/model-routing.mdc` always applies. `AGENTS.md` is read at
workspace root.

### Commands (project slash commands)
`.cursor/commands/*.md` mirrors Claude Code skills; type `/` in chat:
- `/calc-change`, `/brief`, `/delegate-local`
- `/calc-audit`, `/design-review` (switch to a frontier model first)

### Claude Code inside Cursor
Install the Claude Code extension for a side panel, or run `claude` in the
integrated terminal. Same skills and subagents either way.

---

## Zed

Best for: speed. Local-first (`~/.config/zed/settings.json` → backbone).

- **Edit predictions:** `bb-qwen-14b` ghost text. Cursor cannot do this locally.
- **Inline assist:** quick transforms with the default local model.
- **Agent panel:** defaults to `qwen3:30b-thinking` for product reasoning.
- **Rules:** Zed reads `AGENTS.md` from the worktree root.
- Ollama native API: if Cursor's custom models are down, Zed still works.

---

## Claude Code

Best for: anything agentic, multi-step, or risky. Specialist alongside Cursor,
not a full editor replacement.

- No index by design: searches agentically (grep/glob/read). Slower to first
  "where is X?", better on "change X safely".
- Plan mode: Shift+Tab; use for non-trivial work before edits land.
- Skills: `/calc-change`, `/brief`, `/delegate-local`, `/code-review`, `/verify`,
  `/security-review`.
- Subagents: `calc-auditor`, `design-reviewer` (read-only PASS/FAIL).

### Launching inside Cursor
Run `claude` once in Cursor's integrated terminal; then `Cmd+Esc` quick launch
where available. Or run `claude` from any terminal at `MB app build/` (git root).

---

## T3

- Reads `AGENTS.md` like the rest.
- Preview MCP tools can drive the running app for UI verification.

## Other CLI agents (aider, future tools)

Anything AGENTS.md-aware works. For aider, add `read: AGENTS.md` to
`.aider.conf.yml` (or `--read AGENTS.md`).

---

## Recipes

### 1. New roadmap feature, end to end
1. `/brief B7` (or item). Review the sizing tag.
2. `[local]`: `/delegate-local` or Cursor + `qwen3-coder-ctx`.  
   `[strong]`: K3 or Opus in Cursor / Claude Code.  
   `[design-first]`: stop, mock first.
3. Review: `calc-auditor` and/or `design-reviewer`, then `/code-review`.
4. `npx vitest run` from `edgedesk/`, then commit.

### 2. Calc or settlement change (any size)
`/calc-change`, test first, `calc-auditor` before commit. Never land
local-unreviewed calc output.

### 3. UI tweak
Cursor/Zed with local coder or Composer/Grok; design-system rule auto-attaches.
Finish with `design-reviewer` if the diff grew.

### 4. Bulk mechanical change
Claude Code `/delegate-local` → `qwen3-coder-ctx`. Foreman reviews + tests.

### 5. Local or cheap model stuck
One prompt on K3/Opus to break the deadlock, then return to the cheaper lane.
If a task type keeps failing, update the strategy doc matrix.

### 6. Other Models pool running hot
Switch daily agents to Grok/Composer. Reserve K3/Opus for hard turns. Enable
on-demand as a buffer rather than upgrading mid-panic.

---

## Escalation cheatsheet

Escalate immediately when: calc/settlement output, 10+ files, 50K+ context,
stakeholder writing, or long-horizon agentic work. Otherwise: local or
Composer/Grok first, then K3, then Opus/Claude Code.

Full matrix and subscription maths: `docs/Local-vs-Cloud-Model-Strategy.md`.

## Backbone health

Monitoring one-liners are at the bottom of the strategy doc. Quick check:
`ollama ps` on the node. If Zed still works when Cursor's bridge path is down,
it is a tunnel problem, not an Ollama problem.
