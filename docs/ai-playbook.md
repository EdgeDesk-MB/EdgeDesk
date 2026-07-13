# AI stack playbook

**Updated:** 13 July 2026
**Scope:** how to actually drive the stack day to day. The routing analysis and
subscription strategy live in `docs/Local-vs-Cloud-Model-Strategy.md`. Cursor
one-off setup lives in `docs/cursor-setup.md`.

Note: app UI details (menu names, shortcuts) drift between versions. Where a
shortcut below is wrong, the in-app command palette or help is the truth.

---

## Home base

Cursor is home base: it is where you read code, lean on the index, and make
most edits. Zed is the speed tool (local ghost text, instant inline edits).
Claude Code is the specialist you summon for guarded or long-horizon work,
and it does not have to mean a terminal: the Claude Code extension runs in a
Cursor side panel, so "Claude Code" in this playbook can mean that panel
without ever leaving the editor. The guarded workflows also exist as Cursor
slash commands (`.cursor/commands/`), so the safety rails travel with you.

## TL;DR routing

| Job | Open | Model |
| --- | --- | --- |
| Ghost text / autocomplete | Zed | `bb-qwen-14b` (already default) |
| Quick bounded edit, one file | Cursor Cmd+K or Zed inline assist | `qwen3-coder-ctx` |
| Feature work, a few files | Cursor chat/agent | `qwen3-coder-ctx`, escalate on failure |
| Architecture, 10+ files, migrations | Cursor agent, or Claude Code panel | Fable tier |
| Anything touching calc/settlement maths | `/calc-change` in Cursor or Claude Code | frontier only, audited before commit |
| Product thinking, decompositions | Zed agent panel | `qwen3:30b-thinking` |
| Briefs, roadmap docs | `/brief` in Cursor or Claude Code | frontier |
| Stakeholder-facing writing | Claude | Fable 5 / Opus 4.8 |
| Bulk mechanical transforms | Claude Code `/delegate-local` | foreman pattern |
| Review before commit | Claude Code `/code-review` or subagents; in Cursor, `/calc-audit` or `/design-review` | frontier |

## Golden rules

1. **Open `MB app build/` (git root) as the workspace** in every app. That is
   where AGENTS.md, rules and skills are discovered from.
2. **Money maths is frontier-reviewed, always.** Local models may draft, but
   nothing that changes calc/settlement output lands without the `/calc-change`
   workflow plus an audit pass (`calc-auditor` or `/code-review` in Claude Code,
   `/calc-audit` in Cursor). A wrong test is worse than a bug. The gate is the
   workflow, not the app; use whichever tool you are already in.
3. **Local drafts, cloud reviews.** Reviewing a diff costs a fraction of
   generating it. This keeps the 80/20 split honest.
4. **Two strikes then escalate.** If a local model fails the same task twice,
   stop. Except money maths, where you escalate on task type, not failure count.
5. **Trust rules, verify claims.** Local models obey injected rules but
   over-extrapolate from them (see the `matched.ts` "missing test file"
   incident, 13 July 2026). Treat their factual claims about the codebase as
   unverified until you or a frontier model checks.

---

## Cursor

Best for: feature work in the editor with the local coder, cloud escalation in
the same window. Setup checklist: `docs/cursor-setup.md`.

### The three surfaces
- **Tab (ghost text):** Cursor's proprietary model only; it cannot use your
  local models. If you want local ghost text, that is Zed's job.
- **Inline edit (Cmd+K):** bounded, single-file edits. Works with the local
  models via the picker. Your bread and butter with `qwen3-coder-ctx`.
- **Chat / Agent (Cmd+L / Cmd+I):** multi-file work. Model picker at the
  bottom of the input. Agent mode with tool use is strongest on Cursor's
  cloud models; treat local models here as chat-with-context, not agents.

### Model switching
Picker at the bottom of every chat/composer input. Your ladder:
`qwen3-coder-ctx` → Sonnet 5 (local failed twice, or calc work) → Fable tier
(multi-file agentic). `qwen3:30b-thinking` for product questions in chat.

### Context, the @ menu
- `@file` / `@folder`: pin exactly what the model needs. With local models this
  matters double, keep pinned context small (32-64K practical window).
- `@Docs`: add the Next.js 16 docs URL once, then reference them, since local
  models will otherwise answer from stale Next.js training data.
- `@web`: cloud models only, use for library/API lookups.
- `.cursorignore` keeps `eng.traineddata` and `package-lock.json` out of context.

### Rules
`edgedesk/.cursor/rules/*.mdc` auto-attach when matching files enter context
(you verified the pill appears). `AGENTS.md` is read at workspace root. If a
rule ever fails to attach, check the file is actually in context, not just open.

### Commands (project slash commands)
`.cursor/commands/*.md` at the workspace root mirrors the Claude Code skills;
type `/` in chat or agent input to invoke:
- `/calc-change`, `/brief`, `/delegate-local`: thin wrappers that read and
  follow the canonical workflow in `.claude/skills/`.
- `/calc-audit`, `/design-review`: run the reviewer checklists from
  `.claude/agents/` in the current chat. Switch the picker to a frontier model
  first; a local model auditing its own draft defeats the point, and unlike
  Claude Code subagents these run in your chat, not in isolation.
If `/` commands do not appear, your Cursor version may not support them yet;
the canonical versions remain in Claude Code.

### Claude Code inside Cursor
Install the Claude Code extension and it runs in a side panel next to the
editor: same skills, subagents and memory, diffs shown in the editor, no
separate terminal. If the terminal feels foreign, this is the way to run it.

---

## Zed

Best for: speed. Local-first by design, already fully configured
(`~/.config/zed/settings.json` points at the backbone).

- **Edit predictions:** `bb-qwen-14b` ghost text, already on. This is the one
  capability Cursor cannot give you locally.
- **Inline assist (Ctrl+Enter in a buffer):** quick transforms with the default
  local model.
- **Agent panel (Cmd+?):** defaults to `qwen3:30b-thinking` with thinking
  enabled. Good for product reasoning next to the code. Switch model from the
  picker in the panel for coder tasks.
- **Rules:** Zed reads `AGENTS.md` from the worktree root automatically.
- Ollama native API means no bridge or tunnel dependency; if Cursor's custom
  models are down, Zed still works.

---

## Claude Code

Best for: anything agentic, multi-step, or risky. Not an editor replacement;
a specialist alongside Cursor.

Two things worth knowing as a Cursor user:
- **The terminal is Cursor's integrated terminal** (`` Ctrl+` ``). You do not
  need a separate window. An Anthropic VS Code extension exists that may add a
  side panel; search `anthropic` in Cursor's extension marketplace
  (`Cmd+Shift+X`) or run `/ide` inside a `claude` session to try connecting it.
  If it's not available, the integrated terminal is the real tool.
- **No index, by design.** Cursor embeds the repo and retrieves; Claude Code
  searches agentically (grep, glob, reading files) the way an engineer would.
  Slower to first answer on "where is X?", better on "change X safely",
  because it verifies as it goes instead of trusting retrieval. Use Cursor to
  find, Claude Code to change carefully.

### Launching inside Cursor
Run `claude` once in Cursor's integrated terminal (`` Ctrl+` ``) — it detects
Cursor and self-installs the extension. After that:
- **`Cmd+Esc`** — Quick Launch from anywhere in Cursor
- **`Cmd+Option+K`** — reference a file or specific lines in your input
- Open files and selected text flow into context automatically
- Claude's proposed edits appear as inline diffs in the editor (+/- view)

Or run `claude` from any terminal pointed at `MB app build/` (git root). Both
CLAUDE.md files load automatically.

Plan mode: Shift+Tab cycles modes; use it for anything non-trivial so you
approve the approach before edits land.

### Project skills (type `/` to see all)
- `/calc-change` before touching stake/lay/commission/settlement maths.
- `/brief <roadmap item>` to produce an implementation brief with
  [local]/[strong]/[design-first] sizing.
- `/delegate-local <task>` to have Claude foreman a bounded job out to the
  Ollama backbone and review the result before it lands.

### Built-in skills worth using
- `/code-review` on the working diff before committing (levels low→max;
  `/code-review ultra` runs a billed multi-agent cloud review of the branch).
- `/verify` to exercise a change end to end rather than trusting tests alone.
- `/security-review` before anything touching the DB layer or file imports.

### Subagents (ask by name, or Claude invokes them itself)
- "Run the calc-auditor on my diff" after any calc/offers change.
- "Run the design-reviewer on this" after UI changes.
Both are read-only, they report PASS/FAIL with file:line references.

### Useful habits
- `#` at the start of a message saves a memory for future sessions.
- `!` prefix runs a shell command directly.
- Esc interrupts a runaway turn; double Esc edits your previous message.
- `/clear` between unrelated tasks keeps context sharp and cheap.
- Commit etiquette: Claude only commits when you ask it to.

---

## T3

- Reads `AGENTS.md` like the rest, so the guardrails travel for free.
- Its preview MCP tools (browser preview, click, type, snapshot) are wired into
  Claude Code sessions here, which is how Claude can drive the running app to
  verify UI changes. Ask Claude to "open the preview and check X" after UI work.

## Other CLI agents (aider, future tools)

Anything AGENTS.md-aware works out of the box. For aider specifically, add
`read: AGENTS.md` to `.aider.conf.yml` (or pass `--read AGENTS.md`) so the
rules load; it does not discover them automatically.

---

## Recipes

### 1. New roadmap feature, end to end
1. Claude Code: `/brief B7` (or whichever item). Review the sizing tag.
2. `[local]`: `/delegate-local` the brief, or paste it into Cursor with
   `qwen3-coder-ctx`. `[strong]`: let Fable 5 implement it in Claude Code.
   `[design-first]`: stop, produce the mock first.
3. Review: `calc-auditor` and/or `design-reviewer`, then `/code-review`.
4. `npx vitest run` from `edgedesk/`, then commit.

### 2. Calc or settlement change (any size)
Claude Code only. `/calc-change`, test first, `calc-auditor` before commit.
Never route these through a local model unreviewed, whatever the size.

### 3. UI tweak
Cursor or Zed with the local coder; the design-system rule auto-attaches in
Cursor. Finish with the `design-reviewer` subagent if the diff grew beyond a
tweak, and check against `edgedesk/docs/design-system.md`.

### 4. Bulk mechanical change (renames, codemods, boilerplate)
Claude Code `/delegate-local`, model `qwen3-coder-ctx`. Claude writes the
self-contained prompt, reviews the output, runs the tests.

### 5. Local model is stuck or looping
One prompt on a cloud model to break the deadlock, then return local. If the
same task type keeps failing, note it in the strategy doc's routing matrix so
the default changes.

---

## Escalation cheatsheet

Escalate to cloud immediately when: the task touches calc/settlement output,
spans 10+ files, needs 50K+ tokens of context, is stakeholder-facing writing,
or is a long-horizon agentic job (many tool calls). Otherwise: local first,
two strikes, then up the ladder. Full matrix and subscription maths:
`docs/Local-vs-Cloud-Model-Strategy.md`.

## Backbone health

Monitoring one-liners are at the bottom of the strategy doc. Quick check:
`ollama ps` on the node, and Zed still working when Cursor's bridge path is
down tells you it is a tunnel problem, not an Ollama problem.
