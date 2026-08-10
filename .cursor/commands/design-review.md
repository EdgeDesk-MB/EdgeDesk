# Design review (read-only)

Delegate this to the `design-reviewer` subagent (read-only, inherited model — run from a frontier model).

It reads `edgeways/docs/design-system.md` first, every time, then follows the checklist in `.cursor/agents/design-reviewer.md`: colour tokens only, documented patterns for headers/stat strips/pills/lists, shadcn primitives over bespoke re-implementations, British English copy with commas not em dashes, times via `formatClockTime` / `formatClockString` — plus states, accessibility and generic-AI-tell checks.

No file edits. Each deviation reported with file:line and what the design system expects instead, ending with a one-line verdict: conforms, or needs changes.
