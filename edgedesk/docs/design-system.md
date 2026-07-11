# EdgeDesk design system

Flashscore-inspired desk chrome for a sports-app feel: neutral greys, compact density, restrained accent colour.

## Colour tokens

Defined in `src/app/globals.css`:

| Token | Use |
|-------|-----|
| `--primary` | Links, focus rings, chart accent - muted slate-blue (not loud brand blue) |
| `--selection-subtle` / `--selection-subdued` | Hover and selected list rows, header bands |
| `--border` | Tightened neutral borders (`border-border/80` on cards and tables) |
| `--negative` | Loss P&L (dark mode uses a lighter red) |

Movement / profit uses semantic green/red via `MoneyFlow` - primary is for chrome only.

## Page headers

**`DeskPageHeader`** (`src/components/layout/desk-page-header.tsx`) - title band on `sectionBar` background, optional description, help `?`, action slot, optional toolbar.

**`PageHeader`** (`src/components/help/page-header.tsx`) wraps `DeskPageHeader` with a bordered shell. Use on all main app pages.

**`CalculatorPageHeader`** - borderless meta band for calculator shells.

**`ToolbarRow`** - filter pills and secondary controls below the title band (`sectionMeta` background).

## Stat strips

**`StatStrip`** + **`StatTile`** (`src/components/layout/stat-strip.tsx`) - 2–5 column grid of compact metric tiles. Used on Dashboard, Racing Desk, Tracker.

## Pills & lists

From `src/lib/ui/surface-styles.ts`:

- **`filterPillState(active)`** - rounded filter toggles (history, tracker tabs, offers)
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
    action={<Button size="sm">Action</Button>}
    toolbar={<button className={filterPillState(true)}>Filter</button>}
  />
  <StatStrip columns={4}>
    <StatTile label="Metric" value="123" sub="optional" />
  </StatStrip>
  {/* page content */}
</PageShell>
```
