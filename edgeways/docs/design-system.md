# Edgeways design system

Compact sports-desk chrome for a sports-app feel: neutral greys, compact density, with a replaceable brand accent (default Amber `#FFC71E`) as the primary CTA and highlight.

## Colour tokens

Defined in `src/app/globals.css`:

| Token | Use |
|-------|-----|
| `--brand` | **User accent** (default Amber). Raw selected colour — fills (dark primary, topbar in dark) |
| `--brand-logo` | Light-mode lockup + Beta + burger fill — lifted to ≥ 0.55 luminance on ink when raw brand is dark (same floor as `--brand-text`; saturation preserved) |
| `--brand-logo-foreground` | Type on the logo plate (light burger) — `#111` / white by logo luminance |
| `--brand-text` | **Readable accent type** on dark canvas / ink plates. Raw brand when light; lifted when dark (luminance &lt; 0.45 → ≥ 0.55) |
| `--brand-highlight` | **Thin accents on light surfaces** (tab underlines, mobile stripe). Raw brand when ≤ 0.45 luminance; darkened when brighter |
| `--brand-foreground` | Type **on** raw brand fills — `#111` or white by the same luminance threshold |
| `--primary` | **Button fills only** (`bg-primary`): light = ink `#111`; dark = `var(--brand)` |
| `--primary-foreground` | Text/icons on primary fills: light = `--brand-text`; dark = `--brand-foreground` |
| `--primary-hover` | Lightens the primary plate (ink → lighter in light; brand → `color-mix` with white in dark) |
| `--primary-text` | **Inline accent** on surfaces: ink `#111` in light, `--brand-text` in dark. Use `text-primary-text` for links, icons, selected nav — never brand body text on white |
| `--highlight` | Accent underlines — `--brand-highlight` in light, `--brand-text` in dark |
| `--chip` / `--chip-foreground` | Ink `#111` plate + `--brand-text` — legacy ink chips / badges (segmented tabs and filter pills use solid `--brand`) |
| Nav counters (`brandChipCount`) | Light: ink `#111` + off-white `#fafafa` type; dark: same mute as unselected filter-pill counts (`foreground/10` + `foreground/70`) |
| `--selection-subtle` / `--selection-subdued` | Hover and selected list rows, header bands |
| `--stat-tile-selected` / `--stat-tile-selected-border` | Interactive `StatTile` summary tabs — white plate (light) / lifted grey (dark); rim via 1px box-shadow only |
| `--ew-stat-tile-selected-face` | Selected StatTile glossy inset face (stronger than `--ew-surface-face`) |
| `--stat-tile-hover-mix` / `--stat-tile-press-mix` | Inactive interactive tile hover / press `color-mix` toward `--stat-tile-selected` |
| `--border` | Tightened neutral borders (`border-border/80` on cards and tables) |
| `--negative` | Loss P&L + Racing Desk holding/elapsed status. Light = deeper brick (`oklch` ~0.5 / 0.14); dark = lighter red for canvas contrast |
| `--success` | Qualifying / completed / positive eligibility (not P&L) |
| `--warning` | Caution and execution risk only (near-min fields, NR traps, real warnings). Light = mid amber (`oklch` 0.54 / 0.18 / 68) so type and 10% washes stay amber, not khaki. Dark = lifted gold (`oklch` 0.72 / 0.13 / 75) for canvas contrast |
| `--edge` | **Offer Edge / free-bet campaign signature** (violet). Race picks, recommended markers, Edge today, side-nav `Pro` mark (`proNavTag` = same plate as `edgeNavTag`) with `--edge-foreground` on the plate. Also: FB badge, Convert CTA, campaign pipeline **awarded / converting** label + bar (`text-edge` / `bg-edge`). Gift / promo-balance rows may still use historical `violet-*`; Zap there is the shared lightning motif. Marketing Edge plan: mixed rim, shine, and trial button use `--edge`. Choose Core uses `--marketing-brand`. |

Movement / profit uses semantic green/red via `MoneyFlow` - primary is for chrome only.

**Brand on light surfaces.** Brand accent fails contrast on white/page backgrounds. Light-mode primary buttons are ink + brand type (same recipe as chips). Use `text-primary-text` for non-button accent text (links, icons, sublines). Do not use `text-primary` for body copy in light mode.

**Subscription.** Settings → Subscription (first tab, `/settings?tab=subscription`): live plan and status from `app_users` (EDGE-5), **Manage billing** into Stripe Customer Portal, return lands on this tab. Free or cancelled shows Start 14-day Edge trial / Choose Core. Clerk is identity only. Do not build a custom card form. Portal upgrade/downgrade leftovers stay EDGE-4.

**Appearance.** Settings → Appearance: Light/Dark (`ThemeSelect`), UI font dropdown (`UiFontSelect`: Noto Sans (default), Figtree), header pattern picker (`HeaderPatternSelect`: twelve [Hero Patterns](https://heropatterns.com/) tiles, default Diagonal lines), plus brand accent presets (Amber, Viridian, Coral, Azure, Orchid, Citrine, Rose) and Custom colour picker. Default keeps next/font on `--font-sans` (Noto); Figtree sets `html[data-font="figtree"]` so `--font-sans` / `--font-heading` resolve to `--font-figtree` (persisted in localStorage, SSR cookie `edgeways-ui-font`, and `AppSettings.uiFont`; FOUC script in `<head>`). Accent apply sets `--brand` plus contrast tokens; swatches show a loader until settle, then the selected style. Non-default accent/font/pattern persist in localStorage, an SSR cookie, and `AppSettings`. Choosing the product defaults (Amber, Noto, diagonal lines) **clears** those stores so a hard refresh paints CSS defaults. Public demo never reads or writes appearance prefs (always Amber + Noto). A blocking head script mirrors localStorage/cookie before paint; brand colour transitions only run after `html.brand-accent-ready` (avoids Amber → selected flash).

**Brand contrast.** Relative luminance threshold `0.45` on the raw brand:

- **On brand fills** (dark primary, CTA faces): `--brand-foreground` is white when brand is dark, `#111` when light. Pro / Edge nav marks use `--edge` / `--edge-foreground` instead. Active filter-pill counts do **not** use brand-on-brand — see Filter pills below.
- **As type on dark/ink** (selected nav, counters, chips): `--brand-text` keeps light brands as-is and lightness-lifts dark brands to ≥ 0.55 luminance (saturation unchanged) so Viridian etc. stay readable without going neon.
- **As thin strokes on light surfaces** (line-tab underlines, mobile topbar stripe): `--brand-highlight` keeps mid/dark brands as-is and darkens bright brands to ≤ 0.45 luminance — reverse of the brand-text lift; saturation unchanged.
- **Topbar:** same flip for lockup / inactive meta (`--brand-on-topbar`). Light mode ink plate uses `--brand-logo` for the lockup, Beta plate, **and** burger (`--topbar-accent`) — dark brands are lifted to the brand-text floor (≥ 0.55) so Viridian etc. clear `#111`; inactive meta tabs are white. Burger icon uses `--brand-logo-foreground` (logo-plate luminance — ink once the lift crosses 0.45).

**Pressable buttons (react-3d-button).** `default` / `pagePrimary` / `outline` / `secondary` / `destructive` / `success` on `Button` render through `PressButton` (`components/ui/button-3d.tsx`). Depth is **Shopify-style** (Polaris `shadow-button` via `--ew-btn-shadow`): no chunky extruded colour slab — a 1px inset bottom lip + top shine on the face. Press switches to `--ew-btn-shadow-pressed` and shunts content **0.25px** down. Hover is a **stable** 0.5px content shunt (no left/right skew tracking — that jittered icon+label lock-ups). Ghost / link / `asChild` stay flat (no pack press), but share the same face shadow tokens. **Never put `DialogTrigger asChild` / `PopoverTrigger asChild` on a pressable `Button`** — Radix trigger props force the flat path, so the control ends up taller / differently faced than Press siblings. Use controlled `open` + `Button onClick` (dialogs) or `PopoverAnchor` (DatePicker) instead. Icon + label use a **6px** gap (`0.375rem`) on the pack’s inner content span. Campaign-card outline clusters (`outlineButtonGroup`) must keep every outline `sm` control on the Press path at the same height. Toggle: `toggle` + `active` / `onToggleChange` (Racing Desk Track race / Tracked; success when on). Prefer `size="lg"` (`h-9`) for page-header action clusters.

**Filter pills & segmented tabs.** Page filters use `<FilterPill>` (`components/ui/filter-pill.tsx`) — PressButton + `rounded="full"`, inactive outline face, active solid `--brand` plate + `--brand-foreground` type (same filled-accent pattern as `tone="edge"` violet). `TabsList variant="segmented"` (e.g. Do next Priority / Edge / Rate) uses the same active brand plate. The active fill is a shared sliding plate (`useSlidingIndicator`, same spring as line-tab underlines) — do not snap a per-trigger background. Per-tab plate colour via `data-plate` on the trigger (`edge`, `ink`; default `--brand`). The track is `bg-foreground/8` in light so it reads on canvas and cards (`dark:bg-input/30`). **Counts** via `filterPillCountState()`: inactive = muted fill; active = ink `#111` + off-white `#fafafa` in both themes so the number stays white on any user brand and on edge violet (never brand-on-brand, brand-on-edge, or dark-mode `--brand-text`). Faces use `--ew-chip-shadow`: soft **white** inset rims in dark mode (nailed — do not change), soft **dark** inset rims in light mode (same geometry, inverted polarity). Ink plates (Login on #111) use `--ew-ink-plate-shadow` instead. Home compact chips share that recipe via `filterPillState()`. Segmented roots use `activationMode="manual"` (arrows move focus; Enter/Space commits) so arrowing does not thrash content. Focus ring is inset (no offset) so the active pill does not balloon in the track.

**Raised fields / chips (skeuo).** Same Shopify face as buttons (`--shadow-skeuo` = `--ew-btn-shadow`). Works on native inputs. Compact `.skeuo-sm` in light keeps a soft bloom; dark chips share `--ew-btn-shadow` with no extra bloom. Plate `#eeeeee`.

**Dark-mode faces.** On dark / ink plates, inset **dark** lips vanish — use soft **light** top + bottom shine (`--ew-btn-shadow` / `--ew-chip-shadow`, ~0.08–0.14 opacity). Light-mode brand plates invert that with softer **dark** rims (~0.05–0.08) so yellow plates don’t read as high-contrast bezels.

**Campaign / Do next cards & modals.** `.offer-campaign-card` / `.modal-surface` use the same glassy Shopify face as ChromeTab plates and chips (`::after` inset: light = rise-tab plate; dark = `--ew-chip-shadow`). Outer `ring-border/50` in light only — dark drops the old black-mixed ring so the lighten rims can read. Token: `offerCampaignCardShell` in `surface-styles.ts`. Whole-card hover brightness only via `offerCampaignCardInteractive` when the card has a real open/navigate handler (list → details, calendar tile, Do next). Static embeds (Campaign details modal, history rows, Acca/Systems cards) stay flat — no hover without interaction. **Do next** cards add `.do-next-card`: stronger top bevel + glass wash + soft outer rim (Priority / ChromeTab language at card scale; padding and `rounded-[20px]` unchanged). The Home carousel uses a fixed `300px` width (`doNextCarouselCardWidth`) so one card matches a multi-card strip; the mobile stack stays full width.

**Lifted containers (site-wide).** Cards, `.surface-lift`, `.page-panel`, bet panels, and `panelSurface` share a **minimal** glassy face via `--ew-surface-face` / `--ew-surface-rim` (softer than chips / Do next — soft top catch, no boxy stroke). Dark drops outer `ring-*` so the face carries the edge. Prefer `panelSurface` over ad-hoc `rounded-xl border bg-card`. Class escape hatch: `.surface-glass`. Ranked items inside a list modal (Race picks) use `dialogTicketSurface` and sit the dialog on `--page` in both themes (`data-dialog-tone=page` + `dark:bg-page`) so `--card` tickets lift. Do not rest `bg-card` tickets on a `dark:bg-card` dialog.

**Alert toasts.** Rest on `--page-shadow`. Hover uses `--toast-shadow-hover` plus the campaign-card brightness lift (`0.98` light / `1.12` dark). Shadow and filter only, no padding or size change.

**Warning notices.** In-page execution warnings use `<WarningNotice>` (`components/ui/warning-notice.tsx`) on the `warningNotice` token (`surface-styles.ts`): `border-warning/40 bg-warning/10`, title `font-semibold text-warning`, body muted 12px. Same plate as Acca / Bet Builder offer requirements. Softer `warningPanel` (`/25` `/5` + wash) is for tinted cards, not this copy block. `--warning` is for caution and execution risk only. Bold selection names in the body (`<strong>`), not colour alone. Blocked or failed tinted plates use `destructivePanel` (same `/25` `/5` wash as Qualifying / Warning). Neutral inset notes (setup copy, Core upgrade nudge) use `quietPanel`. Edge-tier nudges use `edgePanel`. Onboarding upgrade confirmation uses `successNotice` (`border-success/40 bg-success/10`, no mix-blend wash) with a solid success tick and ink title. Do not use washed `qualifyPanel` plus `text-success` type: that reads muddy in dark.

**Control radius.** `--radius-button` (global − 2px, 10→8) on buttons, fields, and selects via `fieldControl`. Sm/xs share the same radius. Cards / popovers keep `rounded-lg` (`--radius`).

**Fields.** `fieldControl` (`.skeuo-solid.field-control`) on `Input`, `SelectTrigger`, `VenueSelect`, and field textareas. **Text inputs** rest on `--ew-btn-shadow-pressed` (recessed well). **Dropdowns** rest raised (`--ew-btn-shadow`) and press on click/open. Focus-visible adds the brand ring on the face. Don’t use flat `border-input` + `bg-transparent` for new fields.

**Edge vs free-bet violet.** Prefer `--edge` (`text-edge`, `bg-edge`, …) for campaign free-bet chrome that must read in both themes (pipeline stage label + fill, FB badge via `campaignFbBadge`, Convert, awarded/retained figures). Ad-hoc `violet-*` is legacy; new work should not add more. Wallet Gift / promo-balance rows may keep `violet-*` so they stay distinct from modelled “Edge tier” picks — do not casually recolour those rows onto `--edge`.

**Pipeline under playbook.** When Steps is primary, dim the pipeline strip with opacity only. Do not force `text-muted-foreground` onto child labels — a parent `[&_p]:…` colour beats light-mode utilities on specificity while `dark:` variants still win, which made stage labels purple in dark and grey in light.

## Top bar

Public `/demo` viewing bar (`DemoPlanBar`) sits **above** the top nav, never
under it. Plate is `--canvas` with 16px vertical padding on mobile (`py-4`) and 12px from `sm` (`sm:py-3`). The stacked mobile column uses 16px between the Viewing cluster and the plan CTA. Inner row
uses the same cap and page gutter as the top bar (`appShellMaxWidth` +
`--layout-page-x`); the Viewing cluster uses `appNavInset` so it lines up with
the lockup. Plan switcher is `TabsList variant="segmented" size="sm"`. Guests see one plan CTA
(Start 14-day Edge trial, Choose Core, Create a free account) at
`Button size="lg"`, with 24px extra inset to their right (`pr-6`). Choose
Core stays brand yellow + `--brand-foreground` in both themes. Signed-in users
see one action only, from live SQLite not the fixture: **Set up your desk**
if they have no bank or bookie, **Back to your desk** if they already started.
While Clerk or live-status is loading, the bar holds a disabled **Back to your
desk** so the label cannot flash to setup. A failed status read uses that
same return path, not `/setup`.
Plan subscribe buttons stay off for signed-in users (Settings → Subscription).
Plan line ends
with a double space and **View plans** → `https://edgeways.app/#pricing`.
Toast and in-app alert `top` is `--layout-below-header + 16px` (demo bar +
header). Page height subtracts `--layout-below-header` so the desk still fills
the leftover viewport. The first look at public `/demo` opens `DemoNoticeDialog`
with the same single signed-in action. `?live=1` clears `ew_public_demo` so
sign-up and login do not stay on the canned desk.

Top chrome wraps header + meta-nav on `--topbar`, topped by a full-bleed
`--topbar-stripe` band (`--topbar-stripe-h: 4px`). Optional Hero Pattern texture
on `.bg-topbar` (`data-header-pattern`, default Diagonal lines) uses a repeating
SVG mask at 5% of `--topbar-foreground` (white on dark plates, `#111` on light),
faded vertically to 50% opacity at the bottom of the header.
Plate colour flips with theme:

- **Light:** `#111` plate, brand stripe on mobile / canvas stripe on `md+`
  (matches balance/meta tabs), lockup in `--brand-logo`, white
  (`--topbar-muted`) inactive meta labels/icons.
  Burger: `--brand-logo` plate + contrast type
  (`--topbar-accent-foreground`), `skeuo-solid`. Face uses
  `--topbar-accent-face-shadow` from logo-plate luminance — full
  `--ew-btn-shadow` when ≥ 0.45; soft `--ew-chip-shadow` when darker.
- **Dark:** brand plate, `#111` stripe, lockup / foreground / inactive meta
  from `--brand-on-topbar` / `--topbar-muted-on-brand` (white or `#111` by
  luminance). Burger: ink plate + white type; face forced to soft
  chip/`--ew-btn-shadow` (dark theme).
- **Mobile session:** **Log out** sits at the bottom of the burger drawer
  with the other utility rows (icon + label, no chevron). When signed out
  (public `/demo`), that same row is **Log in** → `/login`.
- **Desktop session:** plain type + icon, pinned to the far right of the
  submenu row (`md+`), outside the scrolling tabs so it stays put. No
  ChromeTab plate. 12px (`text-xs`) medium. Signed in: label is the email
  (truncated at 16rem, right-aligned so **Log out** hugs the icon); hover or
  keyboard focus crossfades it to **Log out** over 500ms (`ease-in-out`,
  instant when `prefers-reduced-motion`). Icon stays put. Accessible name is
  always **Log out**. Clerk `signOut` to `/`. Disable while signing out.
  Signed out: the same slot is **Log in** → `/login`. Do not also put Log in
  on the public demo viewing bar.
- **Active meta tab / balance pill:** `ChromeTab` (`components/chrome-tab.tsx`)
  — rise (meta) uses `--chrome-tab-r: 12px`; hang (balance) uses larger
  `--chrome-tab-r-hang: 24px` so TL/TR connectors read into the topbar.
  Rise: `--page` below `sm`, `--canvas` from `sm+`. Hang: always `--canvas`;
  same circle + shadow ear recipe as rise (mirrored to the top), larger
  `--chrome-tab-r-hang`.   Free edges use a soft Shopify face (`.chrome-tab-plate`) — top shine on
  rise, bottom shine on hang — aligned with button/chip rims, not the old
  chunky 3px lip. Meta-nav links press with a 0.25px shunt like PressButton.
  Page panel radius is `0` below `sm`.

1. **`AppTopBarHeader`** — lockup, bankroll stacks, burger (mobile). Fixed `h-14` so the
   balance pill can collapse without reflowing the page. Desktop balances sit
   in `ChromeTab edge="hang"`, top-aligned. A 12px bottom strip (chevron up)
   collapses metrics upward with `COLLAPSE_EASE` height + spring fade
   (`lib/ui/motion.ts`); collapsed keeps a short “Show balances” + chevron-down
   reveal (`localStorage`). The hang pill is always 2×2: Profit + Free bets on
   the left, Exchange (or In-bets when money is tied up) + Total on the right.
   Exchange stays visible at £0.00. Total is never shown on its own.
2. **`AppTopBarMetaNav`** — same plate as the header, all breakpoints. Active
   selection is a `ChromeTab edge="rise"` slid via CSS `translate3d` + width
   (compositor / high-refresh; `META_TAB_*` in `lib/ui/motion.ts`). Label
   colour fades to canvas foreground after the slide. Bottom hairline is
   `sm+` only (avoids a yellow edge under the pill on mobile). Overflowing
   tabs scroll horizontally (mouse drag-to-pan, native swipe on touch). No
   edge fades. A clean click selects a tab; a drag does not.

Meta-nav details:

- **Desk** — working product (any non-meta route). Label avoids the brand name.
  Side nav (`AppNav`) mounts only on Desk routes.
- **Meta tabs** — Settings, Support, Guides, Release notes, Roadmap, Feedback.
  Config in `src/content/meta-nav.ts`. Meta routes omit the side nav entirely
  (`AppShell`) so the page panel is full width.
- **Active tab** — `ChromeTab edge="rise"`, flush with the strip bottom.
- **Settings (side nav)** — on Desk only: Light/Dark `ThemeSelect` plus Default
  exchange. Brand accent lives on Settings → Appearance.
- **Mobile** — same meta strip as desktop; burger drawer still carries desk
  section nav + the meta links.

## Page headers

**`DeskPageHeader`** (`src/components/layout/desk-page-header.tsx`) - title band on `sectionBar` background, optional description, help `?`, action slot, optional toolbar.

**`PageHeader`** (`src/components/help/page-header.tsx`) wraps `DeskPageHeader` with a bordered shell. Use on all main app pages.

**Header stats + CTAs** - pair `PageHeaderStatGroup` with `PageHeaderButtonGroup` inside
`PageHeaderActions className="gap-6"` (24px between supporting text and the contained button
cluster). Stats stay at 8px; buttons inside the cluster stay at 8px.

**Ending date/time shortcuts** - expiry fields pass `shortcuts="ending"` to `DatePicker`
(Tomorrow, 7 days), `TimePicker` / `EventTimeInput` (End of day → `23:59`), and the combined
`DateTimePicker` (Tomorrow + 7 days under the calendar, End of day under the wheels). Compact
`FilterPill` chips sit under the calendar / wheels.

**Modal headers** - every `Dialog` uses the Adjust balance band: `dialogHeaderBand` / `dialogTitle` / `dialogDescription` in `surface-styles.ts` (baked into `DialogHeader`, `DialogTitle`, `DialogDescription`). Title is 20px (`text-xl`) extrabold; the matching title icon is `dialogTitleIcon` (`size-5`). Prefer a short description; when a name or sentence needs more room it **wraps** inside the header (`text-pretty break-words`) — never truncate or overflow the modal. Extra help uses `DialogExplainer` (CircleHelp popover) immediately after the description text, not pinned to the trailing edge of the header. Not a second task. Footer actions stay fully visible (`flex-wrap`). Do not restyle a header with `text-base` or drop the hairline. `p-0` shells cancel the default bleed with `mx-0 mt-0` on the header.

**Tooltips.** Prefer short copy. That is content guidance only — when a name or sentence needs more room the tooltip **wraps** (`text-pretty break-words` on `TooltipContent`). Never `truncate`, `whitespace-nowrap`, or `line-clamp-1` inside a tooltip. Chart marker labels follow the same rule. Overlay width is capped at `--overlay-max` (`min(20rem, 100vw − 1rem)`).

**Overflow (go-live gate).** Nothing may paint outside the viewport or its containing plate. This is a launch blocker.

- **Wrap first.** Titles, descriptions, tooltip/popover copy, and dialog headers use `min-w-0 text-pretty break-words`. Short copy is guidance, not a nowrap mandate.
- **Contain, then scroll.** Tables and chip rows may scroll *inside* their plate (`overflow-x-auto` + `min-w-0 max-w-full`). Page-level horizontal scroll is forbidden.
- **Flex children shrink.** Any `flex-1` / row child that holds copy needs `min-w-0` or it will blow the page.
- **Overlays stay on-screen.** Tooltip, popover, dropdown, and toast cap at `calc(100vw − var(--overlay-gutter))` and wrap. Do not give them a raw `w-*` without a viewport max.
- **Clip the shell.** `html` / `body` / `.app-scroll` / `PageShell` use `overflow-x: clip`. Do not remove that to “fix” a wide child — fix the child. Nested panels that must show a standing scrollbar use `.app-scroll-always` (same thin thumb as `.app-scroll-nested` hover).
- List-row `truncate` is allowed only on fixed-height chrome (nav, feed rows) where the full string is available elsewhere. Never use it as the overflow strategy for tooltips, dialogs, or page titles.

**`CalculatorPageHeader`** - borderless meta band for calculator shells.

**`ToolbarRow`** - filter pills and secondary controls below the title band (`sectionMeta` background).

## Type scale floor (micro copy)

Compact sports-desk density is fine; **illegible micro type is not**.

| Role | Preferred | Absolute minimum |
|------|-----------|------------------|
| XSmall / captions / dense meta | **12px** (`text-xs`) | 11px (`text-[11px]`) |
| Inline icons in text lock-ups at this scale | match type (~12px / `size-3`) | 11px |

**Do not use 10px or smaller** for UI copy, badges, counters, table captions, or tier tags (`text-[10px]`, `text-[9px]`, etc.). Prefer shared tokens in `src/lib/ui/surface-styles.ts` (`sectionDescription`, `captionHeading`, `tableHeaderCell`, `filterPillState`, `brandChipCount`, `navTag` / `proNavTag` / `edgeNavTag` / `demoDataTag`) over one-off pixel sizes.

When bumping micro labels, bump sibling lock-up icons (`size-2.5` → `size-3`) so the pair stays balanced. Decorative chrome (tooltip arrows, wheel gutters) is exempt.

## Stat strips

**`StatStrip`** + **`StatTile`** (`src/components/layout/stat-strip.tsx`) - 2–5 column grid of compact metric tiles. Used on Dashboard, Racing Desk, Tracker.

**Density.** `px-4 py-4`, fixed three-row stack (label / value / sub — sub slot always reserved). Label and sub: `text-[11px]` uppercase / muted; value: `text-2xl` bold tabular.

**Interactive tiles** (`onClick` + `active`) are summary tabs: selected fill `--stat-tile-selected` (white in light, lifted grey in dark) with `--ew-stat-tile-selected-face` and a single 1px shadow rim (`--stat-tile-selected-border`). Fill/face live in `globals.css` on `.surface-lift[data-stat-tile][aria-pressed="true"]` so they beat the shared surface background utility; selected also drops the default `surfaceLift` ring. Focus uses `ring-brand/60`. Non-interactive tiles stay on the default surface plate.

## Tabs

Page section navigation (Settings, Profit Tracker, Fixtures, Racing Desk courses) uses
**underline line tabs**: `TabsList variant="line"` inside `TabsLineBar`
(`src/components/ui/tabs.tsx`). Active tab is bold with a brand underline
(`--highlight` → `--brand-highlight` in light) on a full-width hairline, not a filled pill.

All horizontal `TabsList` variants (line / segmented / default) scroll with drag-to-pan via
`ScrollFadeEdges` — no scrollbar; left/right fades only when content overflows. When every
tab fits, scrolling is inert and fades stay off. Pass `fadeClassName` to match the strip’s
surface (`from-card`, `from-popover`, …). Segmented `size="sm"` is 28px pills
(`h-7`, 11px type) for chrome such as the public demo viewing bar. The viewing
switcher (Free / Core / Edge) uses `data-plate` so the sliding plate is ink,
brand, or `--edge` violet.

**Select vs hold (app-wide).** Tabs activate on a clean click only. Click-and-hold (≥200ms)
or drag-to-pan must not change the active tab — hold is scroll intent. Keyboard
(Enter / Space / arrow focus) is unchanged.

Use line tabs for primary page sections. When a section needs a second filter row underneath
(e.g. Tracker queues: All / Open / Unlayed), keep those as **`filterPillState`** pills, not a
second underline tab strip. Active pills use a solid brand plate (`--brand` /
`--brand-foreground`).

## Pills & lists

From `src/lib/ui/surface-styles.ts`:

- **`filterPillState(active)`** / **`<FilterPill>`** - compact filter toggles under a primary
  line-tab section (e.g. Tracker queues, Racing Desk All / Qualifying / Race picks). Inactive pills
  use muted fill (`bg-muted/60` / `dark:bg-input/30`); active is solid brand
  (`bg-brand text-brand-foreground`). Pass `tone="edge"` for Offer Edge filters so the active
  plate stays violet (`--edge` / `--edge-foreground`).
  Prefer line tabs for page-level section switching.
- **Page CTAs** - `pagePrimaryButtonProps` (`variant="pagePrimary"`, `size="default"` / h-8,
  bold) next to outline siblings via `pageSecondaryButtonProps` at the same height.
- **`listPillState(active)`** - time/selection pills on racecards
- **`listRow`** - hairline stack on a card or plate (`border-b`, hover
  `--selection-subtle`). Use for settings-style rows (welcome Get to know,
  Racing Desk / matcher summaries). Bleed to the plate with `cardBleedX` +
  `cardInsetX` on each row. Drop the last row’s border when a `CardFooter`
  hairline already closes the block.
- **`listRowInteractive`** - rounded pressable block (no hairline). Use for
  standalone taps (quick log, intelligence rows), not a stacked list.
- **`listRowSelected(active)`** - grey selection for sidebar lists
- **`sectionBar` / `sectionMeta`** - panel section headers
- **Day-split lists** (`ListDaySection`) - Campaigns, Casino Campaigns, Tracked
  Events. Label (`Today` / `Yesterday` / `Monday 6th July`) plus a hairline, then
  that day's cards or table. Tokens: `listDaySectionLabel` / `listDaySectionContent`.
  Labels from `formatOfferListGroupLabel`. Do not invent a second day-header
  treatment.
- **`tableHeaderCell` / `tableBodyCell`** - compact table density
- **`deskTrackerSummaryBand`** - Profit Tracker Acca / Bet Builder / Systems
  strip above a bet ledger (`bg-selection-subtle` / dark `bg-input/50`) so the
  workflow block reads against the untinted table
- **`coreNavTag`** / **`edgeNavTag`** / **`PlanNavMark`** — side-nav plan locks.
  Locked N0 rows stay visible with a lock icon plus Core (brand plate) or Edge
  (`--edge` plate). Do not put a section-level Pro tag on Combo Desk or Edge
  Report; those are Core. Offer Edge chrome (Race picks count) stays Edge-only.
- **`demoDataTag`** — solid `--warning` plate + white type. Header Demo data
  mark and Race picks (dialog, confidence chip, trigger) share this so invented
  numbers cannot look live.
- **`emptyStatePlate`** / **`emptyStateIconWell`** / **`emptyStateCopyInset`**
  - empty-state card, circular icon, and page-level copy inset (32px / 64px).
  Page empties lift to `--card` (lighter than `--page` in both
  themes). Inside `[data-slot=dialog-content]` they sink one step on the
  canvas → page → card stack (`--canvas` / dark `--page`) so the plate is
  darker than the default modal (`bg-page` / dark `bg-card`). Page-toned
  list dialogs (Race picks, `data-dialog-tone=page` + `dark:bg-page`) sink
  the empty to `--canvas` in dark so it does not match the shell; the well
  lifts with `--input`. The well follows: `--muted` on a page, `--input` /
  dark `--canvas` in a default modal. Nested in another card, the plate
  sinks to `--page` (`in-data-[slot=card]:bg-page`) so it contrasts with
  the parent. Do not use `--selection-subtle` for the well (it sinks into
  the card in dark mode).

## Empty states

Every content empty (page lists, filtered boards, calendars, tables, **and
modals**) uses `<EmptyState>` from `src/components/help/empty-state.tsx`:
circular icon well, dashed card plate (`border border-dashed ring-0`),
semibold title, muted description, optional CTA. In-feed empties use
`bare` (no plate). Do not ship centred muted text on its own. Plated
empties keep `data-slot="card"` so the glassy face applies; mark them
with `data-empty-state` rather than overwriting the card slot. Page-level
titles are `h2`; compact / nested / dialog titles are `h3`.

Plate polarity follows the canvas → page → card stack (see
`emptyStatePlate`). On a page the plate is lighter than `--page`. Nested
in a card it sinks to `--page`. In a modal it is darker than the dialog
surface. The plate switches via `in-data-[slot=card]` and
`in-data-[slot=dialog-content]`. Page-toned list dialogs also set
`data-dialog-tone=page` so the dark empty sinks to `--canvas`.

- **Page-level** - default padding (`py-10`), page icon, one-line “what will
  appear” plus how to get there. Copy fills the plate (`emptyStateCopyInset`):
  32px from the left and right edges on mobile (`px-8`), 64px from `sm` up
  (`sm:px-16`). Do not cap page empty copy with `max-w-sm` / `max-w-md`.
  Compact and modal empties keep the narrower `max-w-md` measure.
- **Modal** - `compact` so the plate fits the dialog. Keep the dashed rim
  (do not flatten with `shadow-none` unless the empty sits inside another
  lifted card).
- **In-feed** - `bare` (History feed and any similar live feed). Icon well
  and copy sit on the page background: no plate, dashed rim, or radius.
  Page-level History (`/history`) still uses the plate.
- **Nested in a card** - `compact`. Flatten with `className="shadow-none"`
  only for small nested hints (Home live dock, calendars, tracker lists).
  When the empty is the card’s main content (fixture board), keep the plate
  lift and the page-tinted well so it reads against the parent card.
- **Board column** - a kanban cell may use a short muted caption (“Nothing
  here”) instead of a second `EmptyState` plate. The board’s own empty (no
  items / filter miss) still uses `EmptyState`.
- **First-run empty Home** - after bank/bookies exist, `EmptyDeskWelcome` is a
  getting-started hub (several next actions), not a single content gap. Title
  and welcome line sit on the page; a hairline then Get started (2×2 tiles) sit
  under that, then a Quick links row of `size="lg"` outline buttons. “Get to
  know the desk” is a `Card` page area (same shell as Profit
  Tracker) with `listRow` items on the card face. `pb-16` above the footer is
  deliberate air after the list. The card footer holds the full-width
  “⚡ edgeways is made…” note and Feedback form link.
  Render it in a growing `PageShell` (not `fullHeight`) so the app shell scrolls
  like History.
  Do not wrap it in `<EmptyState>`. Setup-missing Home still uses `<EmptyState>`.
- **Loading the same plate** - reuse `<EmptyState busy>` with a spinning
  icon well and a “Loading …” title. Say the list will appear here. Do not
  show the empty copy, or mention Refresh, while the request is in flight.
- **Not this pattern** - dropdown “no matches”, drop-zones, inline row
  hints (“No wallet”), command palette empty.

Copy: British English, sentence case, commas. Title names the gap; description
invites the next action.

## Lay fields (odds and stake)

Every lay-odds and lay-stake input uses the shared exchange increment helpers.
Do not hand-roll `step={0.01}` number inputs for these fields. The Acca / Bet
Builder log-lay row, Add bet, calculators, and Lock in all share this rule.

**Lay odds** — `src/lib/calc/exchange-odds-step.ts` via `exchangeOddsStepping`
on `NumField` / `PanelInput` (or `exchangeOddsStepHandlers` on a raw input).

- Tick ladder is the UK exchange table (Betfair / Betdaq / Matchbook / Smarkets):
  1.01–2.00 ×0.01, 2–3 ×0.02, 3–4 ×0.05, 4–6 ×0.10, 6–10 ×0.20, 10–20 ×0.50,
  20–30 ×1, 30–50 ×2, 50–100 ×5, 100–1000 ×10.
- Up / down arrows (and the scroll wheel) move one exchange tick. From a
  typed off-tick price they go to the next tick only (6.97 → 7.0 / 6.8).
- Manual typing is kept as entered. Do not snap 6.97 to 7.0 on blur. Same
  behaviour as Add bet `PanelInput`.

**Lay stake** — `src/lib/calc/exchange-stake-step.ts` via `layStakeStepping`
on `NumField`, or `LayStakeBanner` (Add bet / calculators).

- UK exchanges accept pounds and pence. Increment is always £0.01.
- Idle display is always two decimal places (`31.56`, `32.00`), never `32`
  or `31.6`. Use `formatLayStake` / `commitLayStake`, not a raw number input.
- Arrow keys and the scroll wheel step one penny. Calculated equalising
  stakes stay on the penny grid (`roundPence` / `executableLayStake`).

Agent rule: `edgeways/.cursor/rules/lay-fields.mdc`.

## Layout

- **`PageShell`** - `max-w-7xl` content width
- **`CalculatorShell`** - centred narrow column for forms
- **`SectionHeader`** - in-card list panel titles (Racing Desk courses, history groups)

## Applying to new pages

```tsx
<PageShell className="gap-5">
  <PageHeader
    title="Page title"
    description="One-line context"
    helpId="dashboard"
    action={<Button {...pagePrimaryButtonProps}>Action</Button>}
  />
  <Card>
    <CardHeader className="pb-0">
      <Tabs value={tab} onValueChange={setTab} className="gap-0">
        <TabsLineBar bleed="card">
          <TabsList variant="line" className="justify-start">
            <TabsTrigger value="a">Section A</TabsTrigger>
            <TabsTrigger value="b">Section B</TabsTrigger>
          </TabsList>
        </TabsLineBar>
      </Tabs>
    </CardHeader>
    <CardContent className="pt-4">{/* section body */}</CardContent>
  </Card>
</PageShell>
```

## Auth canvas

`/login` and `/sign-up` (`(auth)/layout`) are pinned dark, same idea as marketing: ink plate, brand yellow CTA, Clerk card as one dark face. Do not follow the desk Light/Dark toggle. Clerk’s shadcn theme reads host `--card` / `--muted` for the footer strip, so light mode paints a white band under a dark card with unreadable type. The auth root carries `dark` + `scheme-dark`, and `EDGEWAYS_CLERK_APPEARANCE` hard-paints the card and footer.

## Marketing canvas

Waitlist / launch pages live on `.marketing-root` (`--marketing-brand` yellow, `--marketing-canvas` `#0c0c0c` page plate, `--marketing-ink` for type on yellow, `--marketing-band` / `--marketing-band-deep`, `--marketing-rule` for how-it-helps and legal `h2` hairlines). Doc pages (`/contact`, `/terms`, `/privacy`, `/refund`) share `MarketingDocPage` on that canvas. Auth (`/login`, `/sign-up`) uses the same canvas. The desk does not. They pin `--edge` / `--edge-foreground` to the **dark-theme** Offer Edge plate so tags read on ink and do not follow the user’s desk accent. FAQ answers use the section rail, not a nested `max-w-3xl`. Below-fold blocks settle in once (`[data-reveal]`, same 10px rise as `.marketing-fade-up`). Hide only after `html.marketing-reveal-armed` (client, after hash and on-screen marks), so no-JS and `#section` landings stay visible. Re-bind on each marketing pathname: the layout stays mounted, and a client nav (Refunds logo → home) would otherwise leave new reveal nodes at opacity 0. Peer columns (how-it-helps, plan cards) stagger 70ms from `sm` up via `[data-reveal-stagger]`. Hash links use `html.marketing-smooth-scroll { scroll-behavior: smooth }` after first paint so a `#section` landing still jumps. `scroll-padding-top` 1.5rem only (no extra `scroll-mt`). Off under `prefers-reduced-motion`. Hero stays the load fade, not a scroll reveal. Footer stays still. Legal nav is Terms, Privacy, Contact, Refunds. Post-checkout success (`/subscribe/success`) is a still thermal slip on `--marketing-fg` (`.marketing-receipt`, serrated teeth cut to `--marketing-canvas`, dashed `Paid today` rule). Not a printer animation and not a replacement for hosted Stripe Checkout. Paint the slip from the plan immediately; hydrate Stripe ref and email after first paint. Signature is the paid-today line. Yellow CTA is the only accent: **Set up the desk** → `/setup` (waitlist: **Back to Edgeways**). Launch homepage **Try the desk** → `/demo` (read-only fixture, Core/Edge bar). Full-page `/setup` is desk canvas + `panelSurface`, no side nav. Trust copy: subscription confirmed, manage billing (also Settings → Subscription), prices in GBP. No fake lock badges. No “confirming” after Checkout has returned.

Product peeks use `.marketing-panel` + `.marketing-panel-shine` (border-only conic shine; off under `prefers-reduced-motion`). Plan cards share `.marketing-panel`. The featured **Edge** plan adds `.marketing-panel-plan`: rim mixed from `--edge` into the default white/10 (not a solid chroma frame), shine, and a purple trial button. **Choose Core** is the yellow fill CTA. Free stays outline (`hover:bg-white/5`). Card titles are the same species: `text-lg font-semibold` white type, no plates. “Recommended” is `text-xs` sentence case, `text-edge` violet, on the right of the Edge title row. Core gets “Popular” in the same spot, muted grey (`text-white/55`). Comparison ticks follow the column (`size-6`): Free white, Core `--marketing-brand`, Edge `--edge`. Crosses stay muted white so colour means included. Table headers are coloured type (Core yellow, Edge `--edge`), not tags. The monthly/yearly control is centred under the heading: a silver chip (“2 months free with yearly”), then the supplied doodle arrow in the gap pointing at **Bill yearly**, then flanking labels plus a recessed track with a **solid** silver thumb (`--marketing-silver` + `--marketing-silver-face`), `radiogroup` / `radio`. Monthly is the default. The chip is a shortcut onto yearly. Sentence case, not brand yellow or money green. Do not override `edgeNavTag` with brand colours. The logo Beta chip stays on the scaled lockup box (`text-xs` + `scale-[0.625]`).
