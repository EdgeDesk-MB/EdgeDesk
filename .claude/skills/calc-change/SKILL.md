---
name: calc-change
description: Guarded workflow for any change to Edgeways calc or settlement logic (edgeways/src/lib/calc, edgeways/src/lib/offers). Use BEFORE editing stake, lay, commission, EV, or settlement maths, or when a task mentions odds, free bets, extra places, Rule 4, dutching, or profit calculations.
---

# Calc change workflow

Money maths is the product. A wrong sign or a floating-point shortcut costs the
user real money, so this workflow is test-first and non-negotiable.

## Steps
1. Read the relevant section of `edgeways/docs/offer-command-centre.md` and the
   tests covering the module you are changing: a same-named `*.test.ts` where
   one exists, otherwise `calc.test.ts` (the shared calc suite covers modules
   like `matched.ts`). Absence of a same-named test file does NOT mean the
   module is untested.
2. Write or adjust the test FIRST. Express the expected numbers by hand, with
   the worked example visible in the test name or a comment.
3. Implement the smallest diff. Use the helpers in `src/lib/calc/money.ts`;
   never introduce raw floating-point arithmetic in stake/lay/commission paths.
4. From `edgeways/`, run `npx vitest run`. The full suite must stay green.
   NEVER weaken or delete a passing test to get there.
5. If the change affects any EV figure shown in the UI, respect the EV
   provenance rule in `edgeways/docs/roadmap/`: displayed EV must state its basis.

## Forbidden
- Refactoring `src/lib/calc/ep/engine.ts` (spec-locked, see file header).
  Adding consumers is fine; changing combinatorics or normalisation is not.
- Hardcoding market outcomes. Derive them (result-centric model).
- Changing calc output without a test change in the same commit.

## After the change
Run the `calc-auditor` subagent on the diff before committing.
