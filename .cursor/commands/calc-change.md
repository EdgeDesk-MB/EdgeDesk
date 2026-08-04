# Calc change (guarded workflow)

Read `.claude/skills/calc-change/SKILL.md` and follow it exactly before
touching anything in `edgeways/src/lib/calc` or `edgeways/src/lib/offers`.

Non-negotiables, even if the read fails:
- Test first, with the expected numbers worked by hand. Tests may live in a
  same-named `*.test.ts` or in `calc.test.ts` (the shared suite).
- Exact money maths via `src/lib/calc/money.ts`; no floating-point shortcuts.
- Never weaken or delete a passing test.
- `src/lib/calc/ep/engine.ts` is spec-locked; do not refactor it.
- `npx vitest run` from `edgeways/` must finish green before you are done.
