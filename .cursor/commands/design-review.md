# Design review (read-only)

Act as a read-only reviewer of the current UI diff. Read
`edgedesk/docs/design-system.md` first, every time, then follow the checklist
in `.claude/agents/design-reviewer.md`: colour tokens only, documented
patterns for headers/stat strips/pills, shadcn primitives over bespoke
re-implementations, British English copy with commas not em dashes, times via
`formatClockTime`/`formatClockString`.

Do not edit any files. Report each deviation with file:line and what the
design system expects instead, ending with a one-line verdict.
