---
name: design-system-consistency
description: Enforce Edgeways design-system discipline when adding or changing UI. Use whenever components/screens are created or modified in edgeways/src/app or edgeways/src/components — ensures tokens, shadcn primitives, documented patterns and shared utilities are used, and drift is prevented at write time.
---

# Design system consistency (Edgeways)

New UI must look like it was built by the same person on the same day as the rest of the app. `edgeways/docs/design-system.md` is the source of truth — read it before writing UI; do not work from memory of it. Propose changes to it rather than silently deviating.

## Before writing any new UI, in order

1. **Read `edgeways/docs/design-system.md`** — tokens, documented patterns (page headers, stat strips, pills, lists), voice.
2. **Search for prior art** in `edgeways/src/components`: does a component for this job already exist? Extend or compose before creating.
3. **Reach for shadcn/ui primitives** rather than bespoke re-implementations — buttons, dialogs, inputs, selects, dropdowns, toasts, tables.

## Hard rules

- **Colour tokens only.** No ad-hoc hex/rgb/oklch values; no Tailwind palette classes that bypass the design-system tokens. If a needed value doesn't exist, add it to the token layer first (and flag the design-system.md update).
- **Type scale floor.** No UI copy below 11px; prefer 12px (`text-xs`) for XSmall. Use the shared tokens in `src/lib/ui/surface-styles.ts` over one-off pixel sizes. See the `micro-typography` rule and `design-system.md` → "Type scale floor".
- **Documented patterns** for page headers, stat strips, pills and lists — never bespoke variants of these.
- **Copy is British English**, sentence case, commas rather than em dashes. Entity names identical everywhere; action verbs identical through a flow.
- **Times of day** via `formatClockTime` / `formatClockString` from `src/lib/time-format.ts` — never `toLocaleTimeString`. Dates, numbers and currency via the shared formatting utilities.
- **Lay odds / lay stake** via `exchangeOddsStepping` / `layStakeStepping` (or `LayStakeBanner`). Never a raw `step={0.01}` number input. Wheel via `useNonPassiveWheel`, never React `onWheel`. See `docs/design-system.md` → “Lay fields (odds and stake)”.
- **One icon set, one radius language, shadow scale not shadow improvisation, spacing scale only.**
- **Overflow.** Nothing paints outside the viewport or its plate. Wrap (`text-pretty break-words`, `min-w-0` on flex children). Nested clipped scrolls use `ScrollFadeEdges` (no one-off fades). Page-level horizontal scroll is a launch blocker. See `design-system.md` → “Overflow (go-live gate)”.

## Component reuse rules

- A visual pattern appearing a second time is an extraction candidate; a third time makes extraction mandatory.
- Variants over forks: extend with a prop/variant rather than duplicating with tweaks.
- Never locally override a shared component's styling to make one screen "pop" — change the system or use the system.

## When deviation is justified

Only when (a) Sam explicitly asks, or (b) the pattern demonstrably fails the use case. Either way: state the deviation, the reason, and whether it should be promoted into `design-system.md`. Silent one-off deviations are never acceptable.

## Definition of done (consistency)

- [ ] Zero ad-hoc colour values or palette-class bypasses in the diff
- [ ] No bespoke re-implementation of an available shadcn primitive
- [ ] Times/dates/numbers via shared utilities
- [ ] Copy conventions held (British English, sentence case, commas)
- [ ] `design-system.md` still accurate (updated if the system changed)
- [ ] No page-level horizontal overflow; long copy wraps or scrolls inside its plate
- [ ] New screen indistinguishable in "handwriting" from existing screens

After significant UI diffs, delegate to `consistency-checker` (background gate) and `design-reviewer`.
