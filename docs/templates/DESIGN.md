# DESIGN.md — [Project Name]

> Source of truth for this project's visual and interaction design. All agents (main and sub) read this before creating or reviewing UI. Change the system here first, then implement — never deviate silently.

## 1. Product context

- **Subject:** [what this product is, in one sentence]
- **Audience:** [who uses it, in what state of mind]
- **Register:** [e.g. focused work tool / warm consumer app / editorial marketing site]
- **Signature element:** [the one memorable design device this product owns]

## 2. Design tokens

```yaml
color:
  bg:        "#______"   # app background
  surface:   "#______"   # cards / raised surfaces
  text:      "#______"   # primary text (near-black, not #000)
  text-mute: "#______"   # secondary text
  accent:    "#______"   # ONE job: [primary action | focus | signal]
  border:    "#______"
  success:   "#______"
  warning:   "#______"
  danger:    "#______"

type:
  display:   "[Family]"  # characterful, used with restraint
  body:      "[Family]"  # quiet, readable
  mono:      "[Family]"  # data/code only, optional
  scale:     [12, 14, 16, 20, 25, 31, 39]   # ratio: 1.25 — no sizes off-scale
  body-line-height: 1.55
  measure-max: "72ch"

space:
  scale: [4, 8, 12, 16, 24, 32, 48, 64]     # px — no values off-scale

radius:
  language: "[sharp | soft | round]"
  control: "__px"       # buttons, inputs
  surface: "__px"       # cards, modals

shadow:
  sm: "..."             # raised
  md: "..."             # overlay (menus, popovers)
  lg: "..."             # modal

motion:
  micro: "150ms ease-out"
  layout: "250ms ease-out"
  reduced-motion: "always respected"
```

## 3. Voice & copy

- Casing: **sentence case** everywhere [or state exception]
- Buttons name the outcome: "Save changes", never "Submit" / "OK"
- Action verbs stay identical through a flow (Publish → "Published")
- Errors: what went wrong + how to fix. Empty states: what goes here + one action.
- Entity vocabulary (use these exact terms): [e.g. "Project" not "Workspace"; "Member" not "User"]

## 4. Component inventory

| Need | Use | Location | Notes |
|------|-----|----------|-------|
| Button | `Button` | `src/components/ui/button` | variants: primary/secondary/ghost/danger |
| Modal | | | |
| Form field | | | |
| Empty state | | | |
| Toast | | | |
| Table | | | |

Rule: pattern used twice → extraction candidate; three times → extract.

## 5. Icons & imagery

- Icon set: [e.g. Lucide], style: [outlined], size: [16/20/24 only]
- No emoji as UI icons. Illustration style: [describe or "none"]

## 6. Quality gates (definition of done for any UI change)

- [ ] All values from tokens above — zero magic numbers in the diff
- [ ] Five states designed: loading / empty / ideal / error / overflow
- [ ] Keyboard path complete, focus visible, AA contrast
- [ ] Responsive 375 / 768 / 1440 — no horizontal scroll
- [ ] Visual QA loop run (screenshots reviewed) before "done"
- [ ] Consistent with sibling screens (terminology, formatting, patterns)

## 7. Deviations log

| Date | Deviation | Reason | Promoted to system? |
|------|-----------|--------|---------------------|

## 8. Maintenance notes

[Why key decisions were made; what to keep aligned as the product grows]
