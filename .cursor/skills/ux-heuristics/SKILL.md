---
name: ux-heuristics
description: Apply UX interaction-quality standards when building or modifying any interactive UI — forms, flows, navigation, feedback, states. Use when implementing user-facing features, reviewing interaction design, or when a screen needs complete state coverage (loading/empty/error/success). Not for static content or backend logic.
---

# UX Heuristics & Interaction Quality

Every interactive surface must satisfy these standards before it is considered done. They are derived from Nielsen's heuristics, Laws of UX, and WCAG — condensed into checkable rules.

## The Five States rule (most common failure)

Every data-driven view ships with **all five states designed**, not just the happy path:

1. **Loading** — skeleton or spinner that reserves final layout space (no shift on load)
2. **Empty** — explains what will appear here and gives one clear action to get started
3. **Partial/ideal** — the design you were asked for
4. **Error** — says what went wrong + how to recover; retry affordance where sensible
5. **Overflowing** — long names, 10× more items, huge numbers; truncation/pagination/wrapping decided deliberately

If a component is created without all five, flag it as incomplete.

## Feedback & system status

- Every user action gets feedback within 100ms (visual state change) even if the operation takes longer.
- Operations >1s show progress; >10s show progress *and* allow cancel.
- Destructive actions: confirm (or better, allow undo). Undo beats confirmation dialogs.
- Optimistic UI where safe; reconcile visibly on failure.

## Forms

- Label every field (visible label — placeholder text is not a label).
- Validate inline on blur, not only on submit; error messages sit next to the field, state the fix.
- Never clear user input on error. Preserve state on back-navigation.
- Mark optional fields as "(optional)" rather than required fields with asterisks when most fields are required.
- Submit button reflects state: disabled-with-reason or enabled + validation on attempt (prefer the latter for discoverability).
- Correct input types & autocomplete attributes (`email`, `tel`, `autocomplete="name"`, etc.) — mobile keyboards depend on it.

## Navigation & orientation

- Users always know: where am I, how did I get here, how do I get back. Active nav states, breadcrumbs for depth >2, document titles that match page content.
- Back button never breaks. Deep links work. Scroll position is preserved on back.
- Interactive elements look interactive; non-interactive elements don't. Cursor, hover state, and affordance agree.

## Touch & pointer targets

- Minimum target size 44×44px (touch) / 24×24px (pointer) — spacing counts toward this.
- Fitts's law: frequent/primary actions get bigger targets and closer placement; destructive actions get distance.

## Cognitive load

- Hick's law: ruthlessly limit choices per moment. Progressive disclosure over walls of options.
- Recognition over recall: show options, recent items, and context rather than requiring memory.
- Jakob's law: follow platform conventions unless there's a stated reason not to — novelty in navigation is a cost, spend it deliberately.
- Defaults do the work: the most common choice is pre-selected; smart defaults > mandatory configuration.

## Accessibility (non-negotiable floor)

- Full keyboard operability: tab order follows visual order; no traps; Enter/Space activate; Escape closes.
- Visible focus indicator (not `outline: none` without replacement) — 3:1 contrast against adjacent colours.
- Semantic HTML first (`button`, `nav`, `main`, `label`); ARIA only where semantics fall short.
- Images: meaningful alt or `alt=""` if decorative. Icon-only buttons get `aria-label`.
- Colour never the sole carrier of meaning. Motion respects `prefers-reduced-motion`.
- Announce async updates that matter (`aria-live="polite"` for toasts/results).

## Perceived performance

- Reserve layout space for async content (no CLS).
- Skeletons match the shape of real content.
- Stale-while-revalidate over blank-and-spinner where data exists.
- Instant local response, background sync, visible reconciliation.

## When reviewing existing UI

Walk the actual flows as a user would: attempt the primary task, then deliberately do it wrong (bad input, double-click, back mid-flow, refresh mid-flow, slow network). Report failures against the rules above with severity: **Blocker / Major / Minor / Polish**.
