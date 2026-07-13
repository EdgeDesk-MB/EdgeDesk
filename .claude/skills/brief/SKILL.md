---
name: brief
description: Write or update an EdgeDesk implementation brief for a roadmap item, following the docs/roadmap/implementation-briefs.md conventions with [local]/[strong]/[design-first] sizing. Use when asked to brief, spec, scope, or "write up" a feature.
---

# Implementation brief writer

1. Read `edgedesk/docs/roadmap/product-roadmap.md` to find the feature ID
   (A/B/C numbering) and read two or three existing briefs in
   `edgedesk/docs/roadmap/implementation-briefs.md` to match the format exactly.
2. A brief is a self-contained work order. Assume the executing agent has NO
   memory of prior conversations: state file paths, data shapes, acceptance
   criteria, and test expectations explicitly. Verify data shapes against the
   current code before quoting them, and date the verification.
3. Size it with exactly one tag:
   - `[local]` pure functions, isolated UI, strong existing test coverage.
     Suits the local Qwen coder via /delegate-local.
   - `[strong]` schema changes, cross-cutting concerns, judgment-heavy work.
     Needs a frontier model.
   - `[design-first]` wait for a mock or wireframe from Sam before building UI.
4. Call out cross-brief dependencies explicitly and keep the phase grouping.
5. Append or update in `implementation-briefs.md`, then update the
   "Last updated" line and any phase/status table it feeds.
