# Edgeways design system

Flashscore-inspired desk chrome for a sports-app feel: neutral greys, compact density, restrained accent colour.

## Colour tokens

Defined in `src/app/globals.css`:

| Token | Use |
|-------|-----|
| `--primary` | Links, focus rings, chart accent - muted slate-blue (not loud brand blue) |
| `--selection-subtle` / `--selection-subdued` | Hover and selected list rows, header bands |
| `--border` | Tightened neutral borders (`border-border/80` on cards and tables) |
| `--negative` | Loss P&L (dark mode uses a lighter red) |
| `--success` | Qualifying / completed / positive eligibility (not P&L) |
| `--warning` | Caution and execution risk only (near-min fields, NR traps, real warnings) |
| `--edge` | **Offer Edge / modelled EV / pro-tier signature** (violet). Race picks, recommended markers, Best plays. Never use for free-bet lots or pipeline stages |

Movement / profit uses semantic green/red via `MoneyFlow` - primary is for chrome only.

**Edge vs free-bet violet.** Free-bet UI historically used ad-hoc `violet-*` Tailwind. New Edge chrome must use the `--edge` token (`text-edge`, `bg-edge/15`, …). Do not recolour free-bet Gift rows onto `--edge` — that colour means “modelled recommendation / Edge tier”, not “promo balance”.

## Page headers

**`DeskPageHeader`** (`src/components/layout/desk-page-header.tsx`) - title band on `sectionBar` background, optional description, help `?`, action slot, optional toolbar.

**`PageHeader`** (`src/components/help/page-header.tsx`) wraps `DeskPageHeader` with a bordered shell. Use on all main app pages.

**`CalculatorPageHeader`** - borderless meta band for calculator shells.

**`ToolbarRow`** - filter pills and secondary controls below the title band (`sectionMeta` background).

## Stat strips

**`StatStrip`** + **`StatTile`** (`src/components/layout/stat-strip.tsx`) - 2–5 column grid of compact metric tiles. Used on Dashboard, Racing Desk, Tracker.

## Tabs

Page section navigation (Settings, Profit Tracker, Fixtures) uses **underline line tabs**:
`TabsList variant="line"` inside `TabsLineBar` (`src/components/ui/tabs.tsx`). Active tab is
bold with a thick black underline on a full-width hairline, not a filled pill.

Use line tabs for primary page sections. When a section needs a second filter row underneath
(e.g. Tracker queues: All / Open / Unlayed), keep those as **`filterPillState`** pills, not a
second underline tab strip.

## Pills & lists

From `src/lib/ui/surface-styles.ts`:

- **`filterPillState(active)`** - compact filter toggles under a primary line-tab section
  (e.g. Tracker queues, history filters). Inactive pills use muted fill
  (`bg-muted/60` / `dark:bg-input/30`); active is mono accent. Prefer line tabs for
  page-level section switching.
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
