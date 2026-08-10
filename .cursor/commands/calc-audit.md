# Calc audit (read-only)

Delegate this to the `calc-auditor` subagent (it runs read-only on an inherited frontier model — do not run this from a fast/local model; a weak model auditing a strong model's diff defeats the point).

The checklist lives in `.cursor/agents/calc-auditor.md`: no weakened or deleted tests, exact money maths via `src/lib/calc/money.ts`, outcomes derived not hardcoded, `ep/engine.ts` untouched, full Vitest run reported, and at least one changed case recomputed by hand with the working shown.

Do not edit any files. Report PASS or FAIL per item with file:line references, most severe first, ending with a one-line verdict: safe to commit, or not.
