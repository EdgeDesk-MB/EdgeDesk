# Linear, Edgeways

**Updated:** 15 September 2026

How Sam and agents share one board without turning every edit into a
ticket. Agents follow the cheap protocol in `.cursor/rules/iterative-dev.mdc`
and load `.cursor/skills/ticket-hygiene/SKILL.md` only when Linear applies.
Do not paste this file into every chat.

## Where history lives

| Kind | Where | Who writes it |
| --- | --- | --- |
| Cycle work, outcomes, leftovers | Linear comment on the ticket | Agent, one short block |
| Small desk bugs | [EDGE-171](https://linear.app/samhayter/issue/EDGE-171) | Agent comment, never a new issue |
| Code history | Git commit (when you ask) | Agent, on request |
| Durable architecture (D-class) | `docs/decisions/` + roadmap D-row | Rare, you or a briefed agent |

No session-log markdown. That is the burden we are avoiding.

## What gets a ticket

- **Yes:** feature, schema, hosted write, user-facing behaviour, calc/settlement, anything that would otherwise vanish from the cycle.
- **Bucket:** typo, copy, CSS one-liner, small polish → comment on EDGE-171.
- **No:** "just look", test-only, harness-doc edits, local Cmd+K grind.

If you name `EDGE-n` in the prompt, that is scope. Agents must not invent extra work.

## Agent lanes

| Host | Linear |
| --- | --- |
| Orca | `orca linear` (native). MCP optional. |
| Cursor IDE / Claude Code | Linear MCP when authed. If dark, they say so and continue. |
| Local qwen / Cmd+K | Never. They write `Ticket: EDGE-n\|none` for the parent. |

Cursor Linear MCP auth is desktop-only (Settings → MCP). This session cannot complete that login for you.

## Standing ids

- Desk bugs bucket: **EDGE-171**. Do not close it. When comments get long, mark it Done and open a successor titled `Desk bugs (append-only)`, then update this file and the ticket-hygiene skill.
- This convention itself: **EDGE-170**.

## What you do in the morning

Open Linear, not `docs/follow-this-plan.md`, for current work. The plan file is launch history.
