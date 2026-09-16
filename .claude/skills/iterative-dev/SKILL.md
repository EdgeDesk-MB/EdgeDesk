---
name: iterative-dev
description: Cursor-optimised Edgeways implementation loop. Classify the task, load one skill, then smallest verifiable increment. Use when implementing, iterating, building, fixing UI, shipping a change, or working outside the Cursor app (Orca, CLI, cloud agents) with Cursor models.
---

# Iterative development

If `.cursor/rules/iterative-dev.mdc` is already in context, follow that.
Do not also read `docs/cursor-workflow.md`. Hosts without the rule: read
`docs/cursor-workflow.md` and follow it exactly. Do not improvise a
second pre-flight.

In short:

1. Classify (calc / UI / hosted write / feed/store / schema/state /
   docs/roadmap / customer copy / mechanical).
2. Announce files, approach, and `Ticket: EDGE-n|none`.
3. `Read` the matching skill plus one source of truth from the classify
   table. On Orca / CLI / cloud agents, skills do not auto-fire. From
   Claude Code, use this file or the twin under `.cursor/skills/`.
4. Smallest verifiable increment, then targeted tests or an Orca browser
   pass, then the next increment.
5. Matching auditor gate before you stop.

Local / Cmd+K / qwen: skip Linear, MCP, and auditors. Hosts and the cheap
ticket protocol live on the always-on rule. Load `ticket-hygiene` only
when Linear applies.

Hard rules stay in `edgeways/AGENTS.md`. This skill is the loop, not a
replacement for `calc-change` or the design skills.
