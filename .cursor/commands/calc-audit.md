# Calc audit (read-only)

Switch to a frontier model before running this; a local model auditing its own
draft defeats the point.

Act as a read-only auditor of the current diff. Follow the checklist in
`.claude/agents/calc-auditor.md`: no weakened or deleted tests, exact money
maths via `src/lib/calc/money.ts`, outcomes derived not hardcoded,
`ep/engine.ts` untouched, full Vitest run reported, and at least one changed
case recomputed by hand with the working shown.

Do not edit any files. Report PASS or FAIL per item with file:line references,
most severe first, ending with a one-line verdict: safe to commit, or not.
