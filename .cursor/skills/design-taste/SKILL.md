---
name: design-taste
description: Apply senior-level design judgment when creating or restyling any UI — landing pages, product screens, dashboards, components. Use whenever visual direction, typography, colour, spacing, layout, or motion decisions are being made, or when output risks looking generic/templated. Not for pure logic/backend tasks.
---

# Design Taste

**Project precedence:** in the Edgeways repo, `edgeways/docs/design-system.md` outranks everything below — this skill fills the gaps the design system leaves open, it never overrides it. Copy follows the project voice: British English, sentence case, commas rather than em dashes.

Act as the design lead at a studio known for work that could not be mistaken for anyone else's. Every visual decision must be a *choice made for this brief*, not a default. Before writing UI code, form a point of view; after writing it, critique it against that point of view.

## 1. Ground every design in the subject

Before designing, state (briefly, to yourself or in a plan comment):

- **Subject** — what this product/page actually is
- **Audience** — who uses it and in what state of mind (focused work tool ≠ marketing page ≠ consumer app)
- **The page's single job** — the one thing a user must be able to do or understand

Distinctive design comes from the subject's own world — its materials, vocabulary, artefacts. A climbing app and an accounting tool should never share an aesthetic by accident.

## 2. Anti-generic constraints (hard rules)

LLM-generated UI clusters around recognisable defaults. Never use these unless the brief explicitly asks:

- ❌ Purple/violet gradients, or gradient-text headlines as a reflex
- ❌ Cream background + high-contrast serif + terracotta accent (the current "AI look")
- ❌ Near-black background + single acid-green/vermilion accent as a reflex
- ❌ Centred hero → three feature cards → testimonial → CTA, applied regardless of content
- ❌ Card-wrapping everything; cards inside cards
- ❌ Emoji as icons in production UI
- ❌ Numbered markers (01/02/03) when content isn't actually sequential
- ❌ Drop shadows + border + background tint stacked on one element
- ❌ `#000000` text on `#FFFFFF` (use near-black/near-white pairs from the palette)

If a draft matches one of these, revise before presenting.

## 3. Typography carries the personality

- Pair a **characterful display face** (used with restraint) with a **quiet body face**; add a utility/mono face only if data or code demands it.
- Define a deliberate type scale (e.g. 1.2–1.333 ratio) and stick to it — no ad-hoc font sizes.
- Set intentional weight, letter-spacing, and line-height per role. Display type gets tighter tracking and line-height; body gets ~1.5–1.6 line-height, 45–75ch measure.
- Type hierarchy should survive greyscale: if you removed all colour, the structure should still read.

## 4. Colour with discipline

- Build a compact palette: 4–6 named values, with one accent doing one job (primary action / focus / signal — pick one).
- Neutrals do the heavy lifting; accent appears where attention should go, nowhere else.
- Check contrast: 4.5:1 for body text, 3:1 for large text and UI boundaries (WCAG AA).
- Semantic colours (success/warning/danger) must be distinguishable without relying on hue alone (pair with icon/label).

## 5. Spacing and structure are information

- Use a spacing scale (4 or 8pt based). Space *between* groups > space *within* groups — proximity encodes relationships.
- Alignment is non-negotiable: everything sits on a grid; optical alignment beats mathematical alignment for icons and glyphs.
- Structural devices (dividers, eyebrows, labels, numbering) must encode something true about the content, not decorate it.
- Density should match the audience: work tools can and should be denser than marketing pages.

## 6. Motion: one orchestrated moment beats scattered effects

- Choose where motion serves the subject: a page-load sequence, one scroll reveal, hover micro-feedback — not all three everywhere.
- Durations: 120–200ms for micro-interactions, 200–400ms for layout/page transitions. Ease-out for entrances, ease-in for exits.
- Always respect `prefers-reduced-motion`.
- Excess animation is an AI tell. When unsure, cut it.

## 7. Spend boldness in one place

Pick **one signature element** — the thing this page will be remembered by — and keep everything around it quiet and disciplined. Chanel's rule applies: before shipping, remove one accessory.

## 8. Copy is design material

- Name things by what the user controls, in their language — never system internals.
- Active voice; buttons say exactly what happens ("Save changes", not "Submit").
- An action keeps the same name through the whole flow ("Publish" → toast: "Published").
- Errors state what went wrong and how to fix it — never vague, never apologetic. Empty states are invitations to act.
- Sentence case, plain verbs, no filler.

## 9. Process: plan → critique → build → critique again

1. **Plan** a compact token system before coding: palette (named hex values), type pairing + scale, layout concept (one sentence + rough wireframe), signature element.
2. **Critique the plan**: "Would I have produced this exact plan for a different brief?" If yes, it's a default — revise and note what changed.
3. **Build** exactly to the revised plan; derive every colour/size from tokens, never inline magic values.
4. **Critique the build**: screenshot if possible (see `visual-qa-loop` skill), check against sections 2–8, fix, re-check.

## Quality floor (never announce, always deliver)

- Responsive down to 360px without horizontal scroll
- Visible keyboard focus states on all interactive elements
- `prefers-reduced-motion` respected
- Real hover/active/disabled states on all controls
- No layout shift from loading content (reserve space)
