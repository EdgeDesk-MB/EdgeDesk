# Edgeways design system

Flashscore-inspired desk chrome for a sports-app feel: neutral greys, compact density, with a replaceable brand accent (default Amber `#FFC71E`) as the primary CTA and highlight.

## Colour tokens

Defined in `src/app/globals.css`:

| Token | Use |
|-------|-----|
| `--brand` | **User accent** (default Amber). Raw selected colour — fills (dark primary, Pro tag, topbar in dark) |
| `--brand-logo` | Light-mode lockup + Login / burger fill — vibrance/brightness boost of `--brand` |
| `--brand-logo-foreground` | Type on the logo plate (light Login / burger) — `#111` / white by logo luminance |
| `--brand-text` | **Readable accent type** on dark canvas / ink plates. Raw brand when light; lifted when dark (luminance &lt; 0.45 → ≥ 0.55) |
| `--brand-highlight` | **Thin accents on light surfaces** (tab underlines, mobile stripe). Raw brand when ≤ 0.45 luminance; darkened when brighter |
| `--brand-foreground` | Type **on** raw brand fills — `#111` or white by the same luminance threshold |
| `--primary` | **Button fills only** (`bg-primary`): light = ink `#111`; dark = `var(--brand)` |
| `--primary-foreground` | Text/icons on primary fills: light = `--brand-text`; dark = `--brand-foreground` |
| `--primary-hover` | Lightens the primary plate (ink → lighter in light; brand → `color-mix` with white in dark) |
| `--primary-text` | **Inline accent** on surfaces: ink `#111` in light, `--brand-text` in dark. Use `text-primary-text` for links, icons, selected nav — never brand body text on white |
| `--highlight` | Accent underlines — `--brand-highlight` in light, `--brand-text` in dark |
| `--chip` / `--chip-foreground` | Ink `#111` plate + `--brand-text` — active filter pills, segmented tabs, primary badges |
| Nav counters (`brandChipCount`) | Light: ink `#111` + off-white `#fafafa` type; dark: secondary plate + `--brand-text` |
| `--selection-subtle` / `--selection-subdued` | Hover and selected list rows, header bands |
| `--border` | Tightened neutral borders (`border-border/80` on cards and tables) |
| `--negative` | Loss P&L (dark mode uses a lighter red) |
| `--success` | Qualifying / completed / positive eligibility (not P&L) |
| `--warning` | Caution and execution risk only (near-min fields, NR traps, real warnings) |
| `--edge` | **Offer Edge / modelled EV / pro-tier signature** (violet). Race picks, recommended markers, Edge today. Compact mark: `edgeNavTag` (same geometry as `proNavTag`) with `--edge-foreground` on the plate. Free-bet lots keep historical `violet-*`; Zap there is the shared lightning motif, not Offer Edge chrome |

Movement / profit uses semantic green/red via `MoneyFlow` - primary is for chrome only.

**Brand on light surfaces.** Brand accent fails contrast on white/page backgrounds. Light-mode primary buttons are ink + brand type (same recipe as chips). Use `text-primary-text` for non-button accent text (links, icons, sublines). Do not use `text-primary` for body copy in light mode.

**Appearance.** Settings → Appearance: Light/Dark (`ThemeSelect`), UI font dropdown (`UiFontSelect`: Noto Sans (default), Figtree), header pattern picker (`HeaderPatternSelect`: twelve [Hero Patterns](https://heropatterns.com/) tiles, default Diagonal lines), plus brand accent presets (Amber, Viridian, Coral, Azure, Orchid, Citrine, Rose) and Custom colour picker. Default keeps next/font on `--font-sans` (Noto); Figtree sets `html[data-font="figtree"]` so `--font-sans` / `--font-heading` resolve to `--font-figtree` (persisted in localStorage, SSR cookie `edgeways-ui-font`, and `AppSettings.uiFont`; FOUC script in `<head>`). Accent apply sets `--brand` plus contrast tokens; swatches show a loader until settle, then the selected style. Accent is persisted in localStorage, an SSR cookie (`edgeways-brand-accent-hex` so the first HTML paint is already correct), and `AppSettings.brandAccent*`. A blocking head script mirrors localStorage/cookie before paint; brand colour transitions only run after `html.brand-accent-ready` (avoids Amber → selected flash).

**Brand contrast.** Relative luminance threshold `0.45` on the raw brand:

- **On brand fills** (Pro tag, dark primary, filter counts): `--brand-foreground` is white when brand is dark, `#111` when light.
- **As type on dark/ink** (selected nav, counters, chips): `--brand-text` keeps light brands as-is and lifts dark brands to ≥ 0.55 luminance so Viridian etc. stay readable.
- **As thin strokes on light surfaces** (line-tab underlines, mobile topbar stripe): `--brand-highlight` keeps mid/dark brands as-is and darkens bright brands to ≤ 0.45 luminance — reverse of the brand-text lift.
- **Topbar:** same flip for lockup / inactive meta (`--brand-on-topbar`). Light mode ink plate uses boosted `--brand-logo` for the lockup **and** Login / burger (`--topbar-accent`); inactive meta tabs are white. Login type uses `--brand-logo-foreground` (logo-plate luminance — may differ from `--brand-foreground` when the boost crosses 0.45).

**Pressable buttons (react-3d-button).** `default` / `pagePrimary` / `outline` / `secondary` / `destructive` / `success` on `Button` render through `PressButton` (`components/ui/button-3d.tsx`). Depth is **Shopify-style** (Polaris `shadow-button` via `--ew-btn-shadow`): no chunky extruded colour slab — a 1px inset bottom lip + top shine on the face. Press switches to `--ew-btn-shadow-pressed` and shunts content **0.25px** down. Hover pivot stays tiny (~0.5px / 0.25deg). Ghost / link / `asChild` stay flat (no pack press), but share the same face shadow tokens. DatePicker uses `PopoverAnchor` + PressButton (not Radix Trigger) so it matches sibling outline buttons. Icon + label in field-style controls (DatePicker, etc.) use a **6px** gap (`0.375rem`) on the pack’s inner content span. Toggle: `toggle` + `active` / `onToggleChange` (Racing Desk Track race / Tracked; success when on). Prefer `size="lg"` (`h-9`) for page-header action clusters.

**Filter pills.** Page filters / circular tabs use `<FilterPill>` (`components/ui/filter-pill.tsx`) — PressButton + `rounded="full"`, inactive outline face, active ink `#111` + `--brand-text`. Ink faces use `--ew-chip-shadow` (soft light rims) — not the full grey-button `--ew-btn-shadow`, which reads as a heavy bezel on black in light mode. Active type stays `--brand-text` on hover/focus. Home compact chips + segmented tabs share that chip shadow. Focus rings use brand accent and follow the control radius. Dense one-offs may still use `filterPillState()`.

**Raised fields / chips (skeuo).** Same Shopify face as buttons (`--shadow-skeuo` = `--ew-btn-shadow`). Works on native inputs. Compact `.skeuo-sm` in light keeps a soft bloom; dark chips share `--ew-btn-shadow` with no extra bloom. Plate `#eeeeee`.

**Dark-mode faces.** On dark / ink plates, inset **dark** lips vanish — use soft **light** top + bottom shine (`--ew-btn-shadow`, ~0.08–0.14 opacity). Active filter pills must not exceed that strength.

**Control radius.** `--radius-button` (global − 2px, 10→8) on buttons, fields, and selects via `fieldControl`. Sm/xs share the same radius. Cards / popovers keep `rounded-lg` (`--radius`).

**Fields.** `fieldControl` (`.skeuo-solid.field-control`) on `Input`, `SelectTrigger`, `VenueSelect`, and field textareas. **Text inputs** rest on `--ew-btn-shadow-pressed` (recessed well). **Dropdowns** rest raised (`--ew-btn-shadow`) and press on click/open. Focus-visible adds the brand ring on the face. Don’t use flat `border-input` + `bg-transparent` for new fields.

**Edge vs free-bet violet.** Free-bet UI historically used ad-hoc `violet-*` Tailwind. New Edge chrome must use the `--edge` token (`text-edge`, `bg-edge/15`, …). Do not recolour free-bet Gift rows onto `--edge` — that colour means “modelled recommendation / Edge tier”, not “promo balance”.

## Top bar

Top chrome wraps header + meta-nav on `--topbar`, topped by a full-bleed
`--topbar-stripe` band (`--topbar-stripe-h: 4px`). Optional Hero Pattern texture
on `.bg-topbar` (`data-header-pattern`, default Diagonal lines) uses a repeating
SVG mask at 5% of `--topbar-foreground` (white on dark plates, `#111` on light),
faded vertically to 50% opacity at the bottom of the header.
Plate colour flips with theme:

- **Light:** `#111` plate, brand stripe on mobile / canvas stripe on `md+`
  (matches balance/meta tabs), lockup in boosted `--brand-logo`, white
  (`--topbar-muted`) inactive meta labels/icons.
  Login / burger: boosted `--brand-logo` plate + contrast type
  (`--topbar-accent-foreground`), `skeuo-solid`. Face uses
  `--topbar-accent-face-shadow` from logo-plate luminance — full
  `--ew-btn-shadow` when ≥ 0.45; soft `--ew-chip-shadow` when darker.
- **Dark:** brand plate, `#111` stripe, lockup / foreground / inactive meta
  from `--brand-on-topbar` / `--topbar-muted-on-brand` (white or `#111` by
  luminance). Login / burger: ink plate + white type; face forced to soft
  chip/`--ew-btn-shadow` (dark theme).
- **Mobile Login:** top-bar Login is desktop-only; the burger drawer header
  shows Login (label always on) with colours swapped vs desktop — light:
  ink + white (always soft chip face); dark: highlight + ink.
- **Active meta tab / balance pill:** `ChromeTab` (`components/chrome-tab.tsx`)
  — rise (meta) uses `--chrome-tab-r: 12px`; hang (balance) uses larger
  `--chrome-tab-r-hang: 24px` so TL/TR connectors read into the topbar.
  Rise: `--page` below `sm`, `--canvas` from `sm+`. Hang: always `--canvas`;
  same circle + shadow ear recipe as rise (mirrored to the top), larger
  `--chrome-tab-r-hang`.   Free edges use a soft Shopify face (`.chrome-tab-plate`) — top shine on
  rise, bottom shine on hang — aligned with button/chip rims, not the old
  chunky 3px lip. Meta-nav links press with a 0.25px shunt like PressButton.
  Page panel radius is `0` below `sm`.

1. **`AppTopBarHeader`** — lockup, bankroll stacks, Login. Desktop balances sit
   in `ChromeTab edge="hang"`, stretch-flush with Login.
2. **`AppTopBarMetaNav`** — same plate as the header, all breakpoints. Active
   selection is a `ChromeTab edge="rise"` slid via CSS `translate3d` + width
   (compositor / high-refresh; `META_TAB_*` in `lib/ui/motion.ts`). Label
   colour fades to canvas foreground after the slide. Bottom hairline is
   `sm+` only (avoids a yellow edge under the pill on mobile). Narrow
   viewports scroll the row.

Meta-nav details:

- **Desk** — working product (any non-meta route). Label avoids the brand name.
  Side nav (`AppNav`) mounts only on Desk routes.
- **Meta tabs** — Settings, Support, Guides, Release notes, Roadmap, Contact us.
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
(Tomorrow, 7 days) and `TimePicker` / `EventTimeInput` (End of day → `23:59`). Compact
`FilterPill` chips sit under the calendar / wheels.

**`CalculatorPageHeader`** - borderless meta band for calculator shells.

**`ToolbarRow`** - filter pills and secondary controls below the title band (`sectionMeta` background).

## Stat strips

**`StatStrip`** + **`StatTile`** (`src/components/layout/stat-strip.tsx`) - 2–5 column grid of compact metric tiles. Used on Dashboard, Racing Desk, Tracker.

## Tabs

Page section navigation (Settings, Profit Tracker, Fixtures) uses **underline line tabs**:
`TabsList variant="line"` inside `TabsLineBar` (`src/components/ui/tabs.tsx`). Active tab is
bold with a brand underline (`--highlight` → `--brand-highlight` in light) on a full-width hairline, not a filled pill.

Use line tabs for primary page sections. When a section needs a second filter row underneath
(e.g. Tracker queues: All / Open / Unlayed), keep those as **`filterPillState`** pills, not a
second underline tab strip. Active pills use the brand chip style (`--chip` / `--chip-foreground`:
ink plate + yellow type).

## Pills & lists

From `src/lib/ui/surface-styles.ts`:

- **`filterPillState(active)`** - compact filter toggles under a primary line-tab section
  (e.g. Tracker queues, history filters). Inactive pills use muted fill
  (`bg-muted/60` / `dark:bg-input/30`); active is brand chip (`bg-chip text-chip-foreground`).
  Prefer line tabs for page-level section switching.
- **Page CTAs** - `pagePrimaryButtonProps` (`variant="pagePrimary"`, `size="default"` / h-8,
  bold) next to outline siblings via `pageSecondaryButtonProps` at the same height.
- **`listPillState(active)`** - time/selection pills on racecards
- **`listRowSelected(active)`** - grey selection for sidebar lists
- **`sectionBar` / `sectionMeta`** - panel section headers
- **`tableHeaderCell` / `tableBodyCell`** - compact table density

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
