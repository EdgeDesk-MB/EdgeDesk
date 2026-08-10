# Cursor Kit — Edgeways edition

> Daily usage guide (loops, cheat sheets, automation recipes):
> `docs/cursor-daily-guide.md`.

Cursor harness at the git root (`MB app build/`), merged with the design/QA kit.
Claude Code reads `.claude/`; Cursor reads `.cursor/`. Both stay in sync.

## Layout

```
MB app build/
├── .cursor/
│   ├── skills/
│   │   ├── brief/SKILL.md
│   │   ├── calc-change/SKILL.md
│   │   ├── delegate-local/SKILL.md
│   │   ├── design-taste/SKILL.md
│   │   ├── ux-heuristics/SKILL.md
│   │   ├── design-system-consistency/SKILL.md
│   │   └── visual-qa-loop/SKILL.md
│   ├── agents/
│   │   ├── calc-auditor.md
│   │   ├── design-reviewer.md
│   │   ├── ux-qa-auditor.md
│   │   └── consistency-checker.md
│   └── commands/
│       ├── brief.md · calc-audit.md · calc-change.md
│       ├── delegate-local.md · design-review.md
├── .claude/                    ← same skills + agents, Claude Code frontmatter
├── edgeways/docs/design-system.md   ← source of truth for UI
└── docs/templates/DESIGN.md    ← generic kit template; redundant for Edgeways
```

## What changed in the port

- **Frontmatter translated.** Claude Code's `tools: Read, Grep, Glob, Bash` became Cursor's `readonly: true` (both auditors). `model: inherit` encodes your "switch to a frontier model first" command notes; `consistency-checker` pins `model: fast` and runs `is_background: true`.
- **design-reviewer merged.** Your five Edgeways conformance checks (tokens only, documented patterns, shadcn primitives, British English/commas, `formatClockTime`) are now the hard rules, ranked above the kit's general checks (states, a11y, generic-AI tells, screenshot review at three viewports). One reviewer, no overlap with the old kit version.
- **Commands re-pointed** from `.claude/…` paths to `.cursor/…` equivalents. The audit/review commands now say "delegate to the subagent" since Cursor handles model choice via agent frontmatter rather than the picker.
- **Cross-references updated**: `calc-change` ends by delegating to `calc-auditor`; `design-system-consistency` ends by delegating to `consistency-checker` + `design-reviewer`; `brief`'s `[local]` tag points at the `delegate-local` skill.

## Workflow (Edgeways)

**Money-maths change:** `calc-change` skill fires (or `/calc-change`) → test-first with hand-worked numbers → smallest diff via `money.ts` → vitest green → delegate diff to `calc-auditor` → fix FAILs → commit.

**UI change:** `design-system-consistency` + `design-taste` + `ux-heuristics` shape the build → `visual-qa-loop` self-verify (screenshots at 375/768/1440) → `consistency-checker` (background, cheap) + `design-reviewer` → fix Blockers/Majors → commit.

**Roadmap item:** `/brief` → sized `[local]` / `[strong]` / `[design-first]` → `[local]` briefs go through `delegate-local`; `[strong]` in-session on a frontier model; `[design-first]` waits for your mock.

## Caveats to verify (see "Complete after install")

1. **readonly vs vitest.** Cursor's `readonly: true` restricts writes; `npx vitest run` writes test caches. Both auditors are instructed to report "NOT VERIFIED" rather than skip if blocked — if that happens in practice, flip `readonly: false` on `calc-auditor` (the no-edit rule remains in its prompt).
2. **delegate-local from Cursor.** The curl flow works from Cursor's shell if the Mac Studio node is reachable from that machine. Also worth knowing: Cursor supports custom OpenAI-compatible API endpoints, so the Linx bridge (`:8080/v1`) could be registered as a custom model and used natively in the picker — a cleaner path than curl for interactive use; keep the curl flow for scripted delegation.
3. **Skill triggering.** Skills fire off their `description`. If `calc-change` isn't firing before calc edits, strengthen its description's trigger words or invoke `/calc-change` manually — that command's non-negotiables survive even if the skill read fails.

## Extending

- `design-system.md` remains the highest-leverage file — every skill and agent defers to it.
- Always-on conventions (framework patterns, import styles) belong in `.cursor/rules/`, not skills.
- The generic kit (previous zip) stays useful for non-Edgeways projects; this edition is repo-specific.
