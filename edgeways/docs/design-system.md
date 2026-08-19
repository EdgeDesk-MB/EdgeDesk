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
| `--warning` | Caution and execution risk only (near-min fields, NR traps, real warnings) |
| `--edge` | **Offer Edge / free-bet campaign signature** (violet). Race picks, recommended markers, Edge today, side-nav `Pro` mark (`proNavTag` = same plate as `edgeNavTag`) with `--edge-foreground` on the plate. Also: FB badge, Convert CTA, campaign pipeline **awarded / converting** label + bar (`text-edge` / `bg-edge`). Gift / promo-balance rows may still use historical `violet-*`; Zap there is the shared lightning motif. Marketing Edge plan: mixed rim, shine, and trial button use `--edge`. Choose Core uses `--marketing-brand`. |

Movement / profit uses semantic green/red via `MoneyFlow` - primary is for chrome only.

**Brand on light surfaces.** Brand accent fails contrast on white/page backgrounds. Light-mode primary buttons are ink + brand type (same recipe as chips). Use `text-primary-text` for non-button accent text (links, icons, sublines). Do not use `text-primary` for body copy in light mode.

**Appearance.** Settings → Appearance: Light/Dark (`ThemeSelect`), UI font dropdown (`UiFontSelect`: Noto Sans (default), Figtree), header pattern picker (`HeaderPatternSelect`: twelve [Hero Patterns](https://heropatterns.com/) tiles, default Diagonal lines), plus brand accent presets (Amber, Viridian, Coral, Azure, Orchid, Citrine, Rose) and Custom colour picker. Default keeps next/font on `--font-sans` (Noto); Figtree sets `html[data-font="figtree"]` so `--font-sans` / `--font-heading` resolve to `--font-figtree` (persisted in localStorage, SSR cookie `edgeways-ui-font`, and `AppSettings.uiFont`; FOUC script in `<head>`). Accent apply sets `--brand` plus contrast tokens; swatches show a loader until settle, then the selected style. Accent is persisted in localStorage, an SSR cookie (`edgeways-brand-accent-hex` so the first HTML paint is already correct), and `AppSettings.brandAccent*`. A blocking head script mirrors localStorage/cookie before paint; brand colour transitions only run after `html.brand-accent-ready` (avoids Amber → selected flash).

**Brand contrast.** Relative luminance threshold `0.45` on the raw brand:

- **On brand fills** (dark primary, CTA faces): `--brand-foreground` is white when brand is dark, `#111` when light. Pro / Edge nav marks use `--edge` / `--edge-foreground` instead. Active filter-pill counts do **not** use brand-on-brand — see Filter pills below.
- **As type on dark/ink** (selected nav, counters, chips): `--brand-text` keeps light brands as-is and lightness-lifts dark brands to ≥ 0.55 luminance (saturation unchanged) so Viridian etc. stay readable without going neon.
- **As thin strokes on light surfaces** (line-tab underlines, mobile topbar stripe): `--brand-highlight` keeps mid/dark brands as-is and darkens bright brands to ≤ 0.45 luminance — reverse of the brand-text lift; saturation unchanged.
- **Topbar:** same flip for lockup / inactive meta (`--brand-on-topbar`). Light mode ink plate uses `--brand-logo` for the lockup, Beta plate, **and** burger (`--topbar-accent`) — dark brands are lifted to the brand-text floor (≥ 0.55) so Viridian etc. clear `#111`; inactive meta tabs are white. Burger icon uses `--brand-logo-foreground` (logo-plate luminance — ink once the lift crosses 0.45).

**Pressable buttons (react-3d-button).** `default` / `pagePrimary` / `outline` / `secondary` / `destructive` / `success` on `Button` render through `PressButton` (`components/ui/button-3d.tsx`). Depth is **Shopify-style** (Polaris `shadow-button` via `--ew-btn-shadow`): no chunky extruded colour slab — a 1px inset bottom lip + top shine on the face. Press switches to `--ew-btn-shadow-pressed` and shunts content **0.25px** down. Hover is a **stable** 0.5px content shunt (no left/right skew tracking — that jittered icon+label lock-ups). Ghost / link / `asChild` stay flat (no pack press), but share the same face shadow tokens. **Never put `DialogTrigger asChild` / `PopoverTrigger asChild` on a pressable `Button`** — Radix trigger props force the flat path, so the control ends up taller / differently faced than Press siblings. Use controlled `open` + `Button onClick` (dialogs) or `PopoverAnchor` (DatePicker) instead. Icon + label use a **6px** gap (`0.375rem`) on the pack’s inner content span. Campaign-card outline clusters (`outlineButtonGroup`) must keep every outline `sm` control on the Press path at the same height. Toggle: `toggle` + `active` / `onToggleChange` (Racing Desk Track race / Tracked; success when on). Prefer `size="lg"` (`h-9`) for page-header action clusters.

**Filter pills & segmented tabs.** Page filters use `<FilterPill>` (`components/ui/filter-pill.tsx`) — PressButton + `rounded="full"`, inactive outline face, active solid `--brand` plate + `--brand-foreground` type (same filled-accent pattern as `tone="edge"` violet). `TabsList variant="segmented"` (e.g. Do next Priority / Edge / Rate) uses the same active brand plate. **Counts** via `filterPillCountState()`: inactive = muted fill; active = ink `#111` + off-white `#fafafa` in both themes so the number stays white on any user brand and on edge violet (never brand-on-brand, brand-on-edge, or dark-mode `--brand-text`). Faces use `--ew-chip-shadow`: soft **white** inset rims in dark mode (nailed — do not change), soft **dark** inset rims in light mode (same geometry, inverted polarity). Ink plates (Login on #111) use `--ew-ink-plate-shadow` instead. Home compact chips share that recipe via `filterPillState()`. Segmented roots use `activationMode="manual"` (arrows move focus; Enter/Space commits) so arrowing does not thrash content. Focus ring is inset (no offset) so the active pill does not balloon in the track.

**Raised fields / chips (skeuo).** Same Shopify face as buttons (`--shadow-skeuo` = `--ew-btn-shadow`). Works on native inputs. Compact `.skeuo-sm` in light keeps a soft bloom; dark chips share `--ew-btn-shadow` with no extra bloom. Plate `#eeeeee`.

**Dark-mode faces.** On dark / ink plates, inset **dark** lips vanish — use soft **light** top + bottom shine (`--ew-btn-shadow` / `--ew-chip-shadow`, ~0.08–0.14 opacity). Light-mode brand plates invert that with softer **dark** rims (~0.05–0.08) so yellow plates don’t read as high-contrast bezels.

**Campaign / Do next cards & modals.** `.offer-campaign-card` / `.modal-surface` use the same glassy Shopify face as ChromeTab plates and chips (`::after` inset: light = rise-tab plate; dark = `--ew-chip-shadow`). Outer `ring-border/50` in light only — dark drops the old black-mixed ring so the lighten rims can read. Token: `offerCampaignCardShell` in `surface-styles.ts`. Whole-card hover brightness only via `offerCampaignCardInteractive` when the card has a real open/navigate handler (list → details, calendar tile, Do next). Static embeds (Campaign details modal, history rows, Acca/Systems cards) stay flat — no hover without interaction. **Do next** cards add `.do-next-card`: stronger top bevel + glass wash + soft outer rim (Priority / ChromeTab language at card scale; padding and `rounded-[20px]` unchanged).

**Lifted containers (site-wide).** Cards, `.surface-lift`, `.page-panel`, bet panels, and `panelSurface` share a **minimal** glassy face via `--ew-surface-face` / `--ew-surface-rim` (softer than chips / Do next — soft top catch, no boxy stroke). Dark drops outer `ring-*` so the face carries the edge. Prefer `panelSurface` over ad-hoc `rounded-xl border bg-card`. Class escape hatch: `.surface-glass`.

**Alert toasts.** Rest on `--page-shadow`. Hover uses `--toast-shadow-hover` plus the campaign-card brightness lift (`0.98` light / `1.12` dark). Shadow and filter only, no padding or size change.

**Control radius.** `--radius-button` (global − 2px, 10→8) on buttons, fields, and selects via `fieldControl`. Sm/xs share the same radius. Cards / popovers keep `rounded-lg` (`--radius`).

**Fields.** `fieldControl` (`.skeuo-solid.field-control`) on `Input`, `SelectTrigger`, `VenueSelect`, and field textareas. **Text inputs** rest on `--ew-btn-shadow-pressed` (recessed well). **Dropdowns** rest raised (`--ew-btn-shadow`) and press on click/open. Focus-visible adds the brand ring on the face. Don’t use flat `border-input` + `bg-transparent` for new fields.

**Edge vs free-bet violet.** Prefer `--edge` (`text-edge`, `bg-edge`, …) for campaign free-bet chrome that must read in both themes (pipeline stage label + fill, FB badge via `campaignFbBadge`, Convert, awarded/retained figures). Ad-hoc `violet-*` is legacy; new work should not add more. Wallet Gift / promo-balance rows may keep `violet-*` so they stay distinct from modelled “Edge tier” picks — do not casually recolour those rows onto `--edge`.

**Pipeline under playbook.** When Steps is primary, dim the pipeline strip with opacity only. Do not force `text-muted-foreground` onto child labels — a parent `[&_p]:…` colour beats light-mode utilities on specificity while `dark:` variants still win, which made stage labels purple in dark and grey in light.

## Top bar

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
- **Mobile Log out:** the desk is a signed-in surface; there is no Login in
  the app chrome (that CTA lives on the .app homepage). **Log out** sits at
  the bottom of the burger drawer with the other utility rows (icon + label,
  no chevron).
- **Desktop Log out:** plain type + icon, pinned to the far right of the
  submenu row (`md+`), outside the scrolling tabs so it stays put. No
  ChromeTab plate. 12px (`text-xs`) medium. Label is the signed-in email
  (truncated at 16rem, right-aligned so **Log out** hugs the icon); hover or
  keyboard focus crossfades it to **Log out** over 500ms (`ease-in-out`,
  instant when `prefers-reduced-motion`). Icon stays put. Accessible name is
  always **Log out**. Clerk `signOut` to `/`. Disable while signing out.
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
   reveal (`localStorage`).
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

**`CalculatorPageHeader`** - borderless meta band for calculator shells.

**`ToolbarRow`** - filter pills and secondary controls below the title band (`sectionMeta` background).

## Type scale floor (micro copy)

Compact sports-desk density is fine; **illegible micro type is not**.

| Role | Preferred | Absolute minimum |
|------|-----------|------------------|
| XSmall / captions / dense meta | **12px** (`text-xs`) | 11px (`text-[11px]`) |
| Inline icons in text lock-ups at this scale | match type (~12px / `size-3`) | 11px |

**Do not use 10px or smaller** for UI copy, badges, counters, table captions, or tier tags (`text-[10px]`, `text-[9px]`, etc.). Prefer shared tokens in `src/lib/ui/surface-styles.ts` (`sectionDescription`, `captionHeading`, `tableHeaderCell`, `filterPillState`, `brandChipCount`, `navTag` / `proNavTag` / `edgeNavTag`) over one-off pixel sizes.

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
surface (`from-card`, `from-popover`, …).

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
- **`listRowSelected(active)`** - grey selection for sidebar lists
- **`sectionBar` / `sectionMeta`** - panel section headers
- **`tableHeaderCell` / `tableBodyCell`** - compact table density
- **`deskTrackerSummaryBand`** - Profit Tracker Acca / Bet Builder / Systems
  strip above a bet ledger (`bg-selection-subtle` / dark `bg-input/50`) so the
  workflow block reads against the untinted table
- **`emptyStateIconWell`** - circular icon plate above empty-state titles
  (`EmptyState`, Racing Desk in-play empty). Uses `--muted` so the circle is
  darker than the card in light mode and lighter in dark mode. Do not use
  `--selection-subtle` here (that token sinks into the card in dark mode).

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

## Marketing canvas

Waitlist / launch pages live on `.marketing-root` (`--marketing-brand` yellow, `--marketing-ink`, `--marketing-band` / `--marketing-band-deep`). They pin `--edge` / `--edge-foreground` to the **dark-theme** Offer Edge plate so tags read on ink and do not follow the user’s desk accent. Shared FAQ and How-it-helps copy lives in `src/lib/marketing/landing-faq.ts`: we supplement finders, we do not send bookie offers, and the public offer stays Free / Core / Edge.

Product peeks use `.marketing-panel` + `.marketing-panel-shine` (border-only conic shine; off under `prefers-reduced-motion`). Plan cards share `.marketing-panel`. The featured **Edge** plan adds `.marketing-panel-plan`: rim mixed from `--edge` into the default white/10 (not a solid chroma frame), shine, and a purple trial button. **Choose Core** is the yellow fill CTA. Free stays outline (`hover:bg-white/5`). Card titles are the same species: `text-lg font-semibold` white type, no plates. “Recommended” is `text-xs` sentence case, `text-edge` violet, on the right of the Edge title row. Core gets “Popular” in the same spot, muted grey (`text-white/55`). Comparison ticks follow the column (`size-6`): Free white, Core `--marketing-brand`, Edge `--edge`. Crosses stay muted white so colour means included. Table headers are coloured type (Core yellow, Edge `--edge`), not tags. The monthly/yearly control is centred under the heading: a silver chip (“2 months free with yearly”), then the supplied doodle arrow in the gap pointing at **Bill yearly**, then flanking labels plus a recessed track with a **solid** silver thumb (`--marketing-silver` + `--marketing-silver-face`), `radiogroup` / `radio`. Monthly is the default. The chip is a shortcut onto yearly. Sentence case, not brand yellow or money green. Do not override `edgeNavTag` with brand colours. The logo Beta chip stays on the scaled lockup box (`text-xs` + `scale-[0.625]`).
