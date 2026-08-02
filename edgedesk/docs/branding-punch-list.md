# F1 — Branding & design punch list

Working list for the brand pass, split into **what Sam provides** (design assets and
decisions) and **what gets wired in code** once assets land. Current state verified
2026-08-02 against `src/app/layout.tsx`, `src/app/manifest.ts`, `public/`, `globals.css`.

## 1. Logo & brand mark (Sam provides)

The current "logo" is `public/chart-line.svg` — it is actually a **house glyph** (Lucide
`home` path), mislabeled, stroke-only `currentColor`. Placeholder, not a brand.

Needed from Sam:

| Asset | Spec | Used for |
| --- | --- | --- |
| Logo mark, master SVG | Square viewBox, reads at 16px, single-colour variant included | Favicon, in-app brand mark |
| `favicon.svg` + `icon.png` 32×32 fallback | From the master | Browser tab |
| `apple-icon.png` | 180×180, **solid background, no alpha** (iOS requirement) | iOS home screen / PWA |
| `icon-192.png` / `icon-512.png` | Maskable safe zone (glyph within central 80%) | Android PWA, manifest |
| Push badge | 192×192 monochrome white-on-transparent | Android notification shade |
| `og-image.png` (optional for now) | 1200×630 | Link previews once the marketing site exists (F4) |
| Wordmark (optional) | SVG, dark + light variants | Top bar, marketing site |

Decisions for Sam:

1. **Brand colour.** `--primary` is currently a quiet steel-navy (`oklch(0.42 0.06 250)`
   light / `oklch(0.58 0.08 250)` dark). Keep navy as the brand base, or does the real
   brand bring its own hue? If the latter, `--primary` re-tokens and the app follows
   automatically — that is the point of the token system.
2. **Edge violet stays reserved.** `--edge` (`oklch(0.5 0.2 295)`) is the Offer Edge /
   pro-tier signature (D5). The logo should not lean on violet, or modelled-recommendation
   chrome loses its distinctiveness.
3. **Dark/light variants** of the mark if it isn't single-colour.

## 2. Icon wiring map (code, once assets land)

| Consumer | File | Today | Fix |
| --- | --- | --- | --- |
| Favicon + apple | `src/app/layout.tsx` `metadata.icons` | Both point at the house SVG; **iOS ignores SVG apple-touch-icons entirely** | `icon.svg`/`icon.png` + `apple-icon.png` convention (drop the manual `icons` block) |
| PWA manifest | `src/app/manifest.ts` | Only the SVG, no PNG fallbacks, no `maskable` purpose | Add 192/512 PNG entries with `purpose: "maskable"` |
| Push notifications | `public/sw.js` | `icon` + `badge` both `/icon-192.png` (black rounded square, white chart glyph) | Point at new assets; badge becomes the monochrome variant |
| Boilerplate | `public/` | `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` still shipped | Delete |
| Theme colour | `manifest.ts` | `#0d0d0f` mirrors `--topbar` | Re-check against final brand |

## 3. Colour tokens (current, for design reference)

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `--primary` | `oklch(0.42 0.06 250)` | `oklch(0.58 0.08 250)` | Brand / primary actions |
| `--success` | `oklch(0.45 0.12 150)` | `oklch(0.62 0.14 150)` | Qualifying / completed / affirmative |
| `--warning` | `oklch(0.55 0.14 75)` | `oklch(0.72 0.13 75)` | Caution only (D5) |
| `--edge` | `oklch(0.5 0.2 295)` | `oklch(0.72 0.16 295)` | Offer Edge / pro signature (D5) |
| `--negative` | `oklch(0.577 0.245 27)` | `oklch(0.78 0.15 22)` | Losses, destructive |
| `--topbar` | `oklch(0.14 0 0)` | `oklch(0.1 0 0)` | Near-black app bar |

P&L green is deliberately **not** `--success`: money movement uses
`moneyPositiveClass` (emerald family) via `MoneyFlow`, per design-system.md.

## 4. Ad-hoc colour consolidation (code sweep, F1)

Files with the most hardcoded palette classes (`emerald-/amber-/violet-/rose-/sky-/blue-`):

| File | Hits | Verdict |
| --- | --- | --- |
| `app/calculators/ep-desk/page.tsx` | 28 | Consolidate — biggest offender, plus its dialog lacks a description (§6) |
| `app/accounts/page.tsx` | 18 | Review — likely bank/health status colours, map to tokens where semantic |
| `components/racing/flashscore-racecard.tsx` | 16 | Review — some deliberate (bookmaker brand chips stay bespoke) |
| `components/add-bet-dialog.tsx` | 14 | Review — free-bet violet stays until the D5 tidy |
| `components/offers/offer-pipeline-strip.tsx` | 12 | **Deliberate** — pipeline stage palette, leave |
| `components/offers/offer-day-calendar.tsx` | 10 | Review |
| rest (19 files, ≤9 each) | — | Sweep during F1 QA |

Rule for the sweep: if the colour *means* something the token system already says
(positive, caution, edge, danger), it moves to the token; bookmaker/exchange brand
colours and the pipeline palette stay.

## 5. Typography

Noto Sans (400–700) + Geist Mono for code/odds, `tabular-nums` on all figures — already
consistent. **Confirm both as brand fonts** (they also read well on the marketing site)
or nominate replacements before F4.

## 6. Dialog & copy consistency

- 42 of 43 dialog files have `DialogTitle`. Two gaps: the EP Desk "Scouting Playbook"
  dialog has no `DialogDescription`, and the command palette (`ui/command.tsx`) has an
  sr-only title only. Both get descriptions during F1.
- Title language: sentence case, no em dashes in user-facing copy (hard rule), British
  English. One sweep across titles/descriptions during F1 QA.

## 7. Deferred but scheduled

- **Contrast audit** (deferred from Phase 8 / G4) — runs as part of F1 once final brand
  colours land, so it only happens once.
- **Spacing/padding sweep** — layout tokens (`appShellGap`, `appShellPadding`,
  `--layout-stack-gap`) exist; F1 QA walks each page against them.
- **Free-bet violet tidy** (D5) — promo `violet-*` chrome migrates to a token in a later
  pass; not blocking.

## Suggested order

1. Sam: brand colour decision + logo mark (§1) — everything else keys off this.
2. Me: icon wiring + boilerplate cleanup (§2), token re-map if the hue changes (§3).
3. Me: colour consolidation sweep (§4) + dialog gaps (§6).
4. Together: page-by-page QA pass (spacing, fonts, contrast) — the harness running,
   light and dark, mobile width included.
