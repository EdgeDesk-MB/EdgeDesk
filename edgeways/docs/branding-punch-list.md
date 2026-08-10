# F1 — Branding & design punch list

Working list for the brand pass, split into **what Sam provides** (design assets and
decisions) and **what gets wired in code** once assets land. Current state verified
2026-08-04 against `src/app/layout.tsx`, `src/app/manifest.ts`, `public/`, `globals.css`.

> **2026-08-04: Edgeways brand assets (rev 2).** Top bar uses the full yellow
> lockup (`brand/masters/logo.png` → `/brand/logo.png`) — bolt + "edgeways"
> wordmark, not the icon alone. Favicon/square are ink-bolt-on-yellow.
> Masters: `favicon.png`, `square.png`, `logo.png`, `notification.png`.
> Compact mark (menu/PWA) remains the yellow-plate SVG bolt. Optional: supply
> a true `edgeways_logo.svg` to replace the PNG lockup.

## 1. Logo & brand mark (Sam provides)

The previous "logo" (`chart-line.svg` house glyph) is deleted; the chamfered bolt above
is the interim mark. Final assets still wanted from Sam:

| Asset | Spec | Used for | Placeholder status |
| --- | --- | --- | --- |
| Logo mark, master SVG | Square viewBox, reads at 16px, single-colour variant included | Favicon, in-app brand mark | ✅ `public/brand/mark.svg` (vector bolt on yellow plate) |
| Lockup as SVG (optional) | Bolt + "edgeways" wordmark as vector, so it stays sharp at any size | Marketing, docs, og-image | ⬜ optional — top bar uses `logo.png` (crisp at current size); only needed if the lockup is used larger |
| `favicon.svg` + `icon.png` 32×32 fallback | From the master | Browser tab | ✅ `src/app/icon.png` (derived) |
| `apple-icon.png` | 180×180, **solid background, no alpha** (iOS requirement) | iOS home screen / PWA | ✅ generated |
| `icon-192.png` / `icon-512.png` | Maskable safe zone (glyph within central 80%) | Android PWA, manifest | ✅ generated, `purpose: maskable` |
| Push badge | 192×192 monochrome white-on-transparent | Android notification shade | ✅ `badge-192.png` (white bolt silhouette from `mark.svg`) |
| `og-image.png` (optional for now) | 1200×630 | Link previews once the marketing site exists (F4) | ⬜ still needed |
| Wordmark (optional) | SVG, dark + light variants | Top bar, marketing site | PNG lockup in top bar (`/brand/logo.png`) |

Decisions for Sam:

1. **Brand colour — DECIDED 2026-08-04 (revised same day).** Yellow `#FFC71E`
   (`oklch(0.856 0.17 87.3)`) is the brand bar + dark-mode primary fill. **Light
   mode primary is flipped**: ink `#111` plate + yellow type (yellow fails
   contrast on white). `--highlight` is yellow for line-tab underlines;
   `--chip` / `--chip-foreground` are ink plate + yellow type for active pills,
   segmented tabs, and primary badges/counters. `--primary-hover` **lightens**
   (ink → lighter plate in light; yellow → brighter in dark). `pagePrimary` is
   token-driven at `size="default"` (h-8) to match outline siblings. Focus rings
   follow yellow. Top bar is yellow with the dark lockup. Product name casing:
   **Edgeways** (title case).
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
| Push notifications | `public/sw.js` | Android shade always has two slots: `badge` (mono white bolt from `mark.svg` — omit → default bell) + `icon` (yellow plate + `#111` bolt from `mark.svg`). Regenerated via `scripts/generate-brand-assets.mjs`. Single yellow-only is not available to web push; titles carry a leading ⚡ |
| Boilerplate | `public/` | Deleted (`file/globe/next/vercel/window.svg`, `chart-line.svg`, `icon-180.png`, `edgeways-bolt.svg`, `icon.svg`) |
| Theme colour | `manifest.ts` + `viewport.themeColor` + `<header>` bg | `#111111` (ink). Dia samples the top element’s `background-color` for tab tint — outer `<header>` stays ink; yellow plate is an inner shell. |

## 3. Colour tokens (current, for design reference)

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `--primary` | `#111111` | `#FFC71E` | Primary **button fills** (flipped in light for contrast) |
| `--primary-foreground` | `#FFC71E` | `#111111` | Text/icons on primary fills |
| `--primary-hover` | lighter ink | brighter yellow | Hover **lightens** the plate |
| `--primary-text` | `#111111` | `#FFC71E` | Inline accent on surfaces (`text-primary-text`) — never yellow on white |
| `--highlight` | `#FFC71E` | same | Line-tab underlines |
| `--chip` / `--chip-foreground` | `#111` / `#FFC71E` | same | Active pills, segmented tabs, primary badges |
| `--success` | `oklch(0.45 0.12 150)` | `oklch(0.62 0.14 150)` | Qualifying / completed / affirmative |
| `--warning` | `oklch(0.55 0.14 75)` | `oklch(0.72 0.13 75)` | Caution only (D5) |
| `--edge` | `oklch(0.5 0.2 295)` | `oklch(0.72 0.16 295)` | Offer Edge / pro signature (D5) |
| `--negative` | `oklch(0.577 0.245 27)` | `oklch(0.78 0.15 22)` | Losses, destructive |
| `--topbar` | `#111` | `#FFC71E` | Header + meta-nav plate |
| `--topbar-stripe` | `--canvas` (`md+`; yellow on mobile) | `#111` | 4px stripe above the plate |
| `--topbar-accent` | `#FFC71E` | `#111` | Login / burger fill |
| `--topbar-accent-foreground` | `#111` | white | Login / burger icon + label |

P&L green is deliberately **not** `--success`: money movement uses
`moneyPositiveClass` (emerald family) via `MoneyFlow`, per design-system.md.

## 3b. Chrome decisions (2026-08-04, landed)

- **Raised controls (skeuo)** — Untitled UI–style inset 3D lip, **no drop shadow**
  (`--shadow-skeuo` = inset only). `.skeuo` / `.skeuo-solid` on Button
  `default` / `pagePrimary` / `secondary` / `outline`, brand chips, badges,
  segmented active tabs. Ghost/link stay flat.
- **Control radius** — 2px tighter than the global ladder via `--radius-button`
  (10→8) on buttons, fields, and selects. Sm/xs share the same radius.
  Cards/popovers keep `rounded-lg`.
- **Secondary / outline buttons** — off-white `#fafafa` fill in light mode,
  same inset 3D, no thick border.
- **Top bar (desktop)** — two rows on `--topbar` (ink light / yellow dark),
  topped by a 4px `--topbar-stripe` (canvas light / ink dark):
  `AppTopBarHeader` + `AppTopBarMetaNav`. Active tab = sliding canvas pill +
  page foreground (`SPRING_EASE`). Login/burger use `--topbar-accent`. Burger
  is mobile-only.
- **Appearance** — Light/Dark only (`ThemeSelect`) at the bottom of the side
  nav on default surface colours. System/OS sync removed to avoid overflow.
- **Filter pills** — `filterPillState(active, { hasCount })`; counters use the
  fixed-size `filterPillCountState` chip so selection doesn’t jump; `hasCount`
  trims right padding by 4px (`pr-2`).

## 4. Ad-hoc colour consolidation (code sweep, F1)

Files with the most hardcoded palette classes (`emerald-/amber-/violet-/rose-/sky-/blue-`):

| File | Hits | Verdict |
| --- | --- | --- |
| `app/calculators/ep-desk/page.tsx` | 28 | ✅ swept — money/EV positives now `moneyPositiveClass`; remaining amber/violet/blue are market-column + model-check semantics (deliberate) |
| `app/accounts/page.tsx` | 18 | Reviewed — amber/sky/violet are account-status + free-bet semantics; free-bet violet stays until the D5 tidy |
| `components/racing/desk-racecard.tsx` | 16 | Reviewed — bookmaker brand chips stay bespoke (deliberate) |
| `components/add-bet-dialog.tsx` | 14 | Reviewed — free-bet violet stays until the D5 tidy |
| `components/offers/offer-pipeline-strip.tsx` | 12 | **Deliberate** — pipeline stage palette, leave |
| `components/offers/offer-day-calendar.tsx` | 10 | ✅ swept — Est. EV greens now `moneyPositiveClass`; rose/amber/sky bars are offer-category palette (deliberate) |
| rest (19 files, ≤9 each) | — | Spot-checked during F1 QA |

Rule for the sweep: if the colour *means* something the token system already says
(positive, caution, edge, danger), it moves to the token; bookmaker/exchange brand
colours, offer-category palettes, and the pipeline palette stay.

## 5. Typography

Noto Sans (400–700) + Geist Mono for code/odds, `tabular-nums` on all figures — already
consistent. **Confirm both as brand fonts** (they also read well on the marketing site)
or nominate replacements before F4.

## 6. Dialog & copy consistency

- ✅ All dialog files now have `DialogTitle` + `DialogDescription`. The EP Desk
  "Scouting Playbook" dialog and the command palette (`ui/command.tsx`, sr-only)
  both gained descriptions 2026-08-04.
- Title language: sentence case, no em dashes in user-facing copy (hard rule), British
  English. One sweep across titles/descriptions during F1 QA.

## 7. Deferred but scheduled

- **Contrast audit** — ✅ ran 2026-08-04 against the final brand tokens. All key
  combos pass WCAG AA: muted-foreground 6.5:1 (light) / 6.2:1 (dark), warning
  4.9:1 / 6.3:1, edge 6.6:1 / 6.1:1, ink-on-yellow topbar 12.1:1, topbar-muted
  3.7:1 (large/meta text), yellow-on-ink chip 12.1:1, yellow `primary-text` on
  dark canvas 12.0:1. Re-run only if a token value changes.
- **Spacing/padding sweep** — layout tokens (`appShellGap`, `appShellPadding`,
  `--layout-stack-gap`) exist; F1 QA walks each page against them.
- **Free-bet violet tidy** (D5) — promo `violet-*` chrome migrates to a token in a later
  pass; not blocking.

## Suggested order

1. Sam: brand colour decision + logo mark (§1) — everything else keys off this. ✅ colour decided; vector bolt in place; lockup SVG optional.
2. Me: icon wiring + boilerplate cleanup (§2), token re-map if the hue changes (§3). ✅ done.
3. Me: colour consolidation sweep (§4) + dialog gaps (§6).
4. Together: page-by-page QA pass (spacing, fonts, contrast) — the harness running,
   light and dark, mobile width included.
