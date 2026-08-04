# F1 — Branding & design punch list

Working list for the brand pass, split into **what Sam provides** (design assets and
decisions) and **what gets wired in code** once assets land. Current state verified
2026-08-04 against `src/app/layout.tsx`, `src/app/manifest.ts`, `public/`, `globals.css`.

> **2026-08-04: Edgeways brand mark landed.** Yellow bolt on ink is the sole top-bar
> logo (text wordmark removed). Masters in `brand/masters/`: `favicon.png`,
> `square.png`, `notification.png`. Icons regenerated via
> `node scripts/generate-brand-assets.mjs`. In-app mark is a 7-point SVG path traced
> from the notification silhouette (`edgeways-logo-icon.tsx` /
> `public/brand/mark.svg`). Optional: supply a design-tool SVG to replace the trace.

## 1. Logo & brand mark (Sam provides)

The previous "logo" (`chart-line.svg` house glyph) is deleted; the chamfered bolt above
is the interim mark. Final assets still wanted from Sam:

| Asset | Spec | Used for | Placeholder status |
| --- | --- | --- | --- |
| Logo mark, master SVG | Square viewBox, reads at 16px, single-colour variant included | Favicon, in-app brand mark | ⬜ **needed** — icons currently derived from a ~105px-tall PNG crop |
| Complete lockup export | The 2026-08-04 PNG dropped the dark wordmark layer (only yellow shapes + transparent pulse knock-out survived) | Marketing, docs | ⬜ re-export needed |
| `favicon.svg` + `icon.png` 32×32 fallback | From the master | Browser tab | ✅ `src/app/icon.png` (derived) |
| `apple-icon.png` | 180×180, **solid background, no alpha** (iOS requirement) | iOS home screen / PWA | ✅ generated |
| `icon-192.png` / `icon-512.png` | Maskable safe zone (glyph within central 80%) | Android PWA, manifest | ✅ generated, `purpose: maskable` |
| Push badge | 192×192 monochrome white-on-transparent | Android notification shade | ✅ `badge-192.png` (pulse silhouette) |
| `og-image.png` (optional for now) | 1200×630 | Link previews once the marketing site exists (F4) | ⬜ still needed |
| Wordmark (optional) | SVG, dark + light variants | Top bar, marketing site | Text wordmark ("Edgeways", title case) in the top bar |

Decisions for Sam:

1. **Brand colour — DECIDED 2026-08-04.** Yellow `#FFC71E` (`oklch(0.856 0.17 87.3)`)
   is `--primary` in **dark mode only**; light mode uses ink `#111111`
   (`oklch(0.178 0 0)`) with white text (Sam's call after reviewing screenshots).
   `--primary-hover` added per theme (lifted ink light, deepened yellow dark); the
   `pagePrimary` page-CTA variant is now token-driven (was hardcoded #111/white), so
   every button follows the brand. Focus rings: ink in light mode, yellow in dark.
   Product name casing: **Edgeways** (title case) in UI text, tab title and manifest.
2. **Edge violet stays reserved.** `--edge` (`oklch(0.5 0.2 295)`) is the Offer Edge /
   pro-tier signature (D5). The yellow brand does not collide with it.
3. **Dark/light variants** of the mark if it isn't single-colour — the pulse mark is
   background-agnostic by design (knock-out takes the surface colour), so likely
   unneeded; confirm when the master SVG lands.

## 2. Icon wiring map (code) — ✅ DONE 2026-08-04, real mark 2026-08-04

| Consumer | File | State |
| --- | --- | --- |
| Favicon + apple | app-directory conventions | `src/app/icon.png` + `src/app/apple-icon.png`; manual `metadata.icons` block removed |
| PWA manifest | `src/app/manifest.ts` | 192/512 PNG entries, `purpose: "any"` + `"maskable"` |
| Push notifications | `public/sw.js` | `icon: /icon-192.png`, `badge: /badge-192.png` (white pulse silhouette); push titles carry a leading ⚡ (see `sendPush`) |
| Boilerplate | `public/` | Deleted (`file/globe/next/vercel/window.svg`, `chart-line.svg`, `icon-180.png`, `edgeways-bolt.svg`, `icon.svg`) |
| Theme colour | `manifest.ts` | `#111111` mirrors brand ink / light-theme `--topbar` |

## 3. Colour tokens (current, for design reference)

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `--primary` | `oklch(0.178 0 0)` (#111111) | `oklch(0.856 0.17 87.3)` (#FFC71E) | Ink in light, brand yellow in dark |
| `--success` | `oklch(0.45 0.12 150)` | `oklch(0.62 0.14 150)` | Qualifying / completed / affirmative |
| `--warning` | `oklch(0.55 0.14 75)` | `oklch(0.72 0.13 75)` | Caution only (D5) |
| `--edge` | `oklch(0.5 0.2 295)` | `oklch(0.72 0.16 295)` | Offer Edge / pro signature (D5) |
| `--negative` | `oklch(0.577 0.245 27)` | `oklch(0.78 0.15 22)` | Losses, destructive |
| `--topbar` | `oklch(0.178 0 0)` (#111111) | `oklch(0.1 0 0)` | Brand ink app bar |

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
