---
name: visual-qa-loop
description: Run a screenshot-driven verification loop after any UI change. Use when implementing or modifying frontend UI, before declaring visual work complete, or when the user asks to check/QA/verify the interface. Requires a running dev server and Orca's embedded browser (orca-cli references/browser.md). Aside (new window) only if Orca cannot host or Sam names Aside. Never Playwright or system Chrome. Falls back to static checks if no browser is available.
---

# Visual QA Loop

UI work is not done when the code compiles — it is done when the rendered result has been *looked at* and passes review. Never declare visual work complete without closing this loop.

## The loop

1. **Render** — ensure the dev server is running. Open a **new** Orca
   tab (`orca tab create --url …`) and work only in that tab. Do not use
   Playwright, Chrome DevTools, or system Chrome. If Orca cannot host
   after retry, Aside in a new window.
2. **Capture** — take screenshots at three viewports minimum:
   - Mobile: 375×812
   - Tablet: 768×1024
   - Desktop: 1440×900
3. **Interact** — exercise the states, don't just look at the default render: hover/focus the primary controls, open menus/modals, submit the form empty, trigger the error path, load with throttled network if possible.
4. **Inspect** — review each capture against the checklist below. Also check the browser console: zero errors, zero React/hydration warnings.
5. **Fix** — address findings in severity order (Blocker → Major → Minor → Polish).
6. **Repeat** — re-capture and re-inspect after every fix batch. Maximum 5 iterations; if still failing, stop and report what's unresolved and why rather than looping forever.

If no browser tool is available: say so explicitly, run the static checks that are possible (lint, type-check, grep for banned patterns), and mark visual verification as **not performed** — never claim it passed.

## Screenshot inspection checklist

**Layout**
- No horizontal scroll at any viewport; no clipped or overlapping elements
- Content respects safe areas and max-widths; text measure ≤ ~75ch
- Alignment: elements sit on the grid; nothing optically "off by 2px"
- No layout shift between loading and loaded states

**Typography & colour**
- Hierarchy readable at a glance: squint test — structure survives blur
- No unstyled fallback fonts flashing/persisting
- Contrast passes AA (4.5:1 body, 3:1 large/UI) — check any text over images
- Only palette colours present (a stray default-blue link is a finding)

**States (capture each, not just default)**
- Hover, focus-visible, active, disabled on interactive elements
- Loading, empty, error, overflow states for data views
- Long-content stress: paste a 60-character name, 3× paragraph text — nothing breaks

**Responsiveness**
- Touch targets ≥44px at mobile
- Nothing important hidden or unreachable at mobile
- Images scale without distortion; tables have a mobile strategy

**Motion**
- Transitions smooth (no jank), durations sane, nothing animates on every render
- `prefers-reduced-motion` verified if animations were added

## Console & runtime checks

- 0 console errors, 0 warnings introduced by the change
- No failed network requests / 404 assets
- No accessibility violations you can see from keyboard and snapshot. Do not start Playwright just to run axe.

## Reporting format

Report findings as a table before fixing:

| # | Severity | Viewport/State | Finding | Fix |
|---|----------|----------------|---------|-----|

Severity definitions: **Blocker** = broken/unusable/inaccessible · **Major** = clearly wrong vs spec or design system · **Minor** = noticeable polish issue · **Polish** = nitpick, fix if cheap.

After the final pass, state explicitly: viewports checked, states exercised, findings fixed, findings deferred (with reasons).
