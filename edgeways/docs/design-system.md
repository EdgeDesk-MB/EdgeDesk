# Edgeways design system

Compact sports-desk chrome for a sports-app feel: neutral greys, compact density, with a replaceable brand accent (default Amber `#FFC71E`) as the primary CTA and highlight.

## Colour tokens

Defined in `src/app/globals.css`:

| Token | Use |
|-------|-----|
| `--brand` | **User accent** (default Amber). Raw selected colour — primary button fills in both themes, plus topbar in dark |
| `--brand-logo` | Light-mode lockup + Beta + burger fill — lifted to ≥ 0.55 luminance on ink when raw brand is dark (same floor as `--brand-text`; saturation preserved) |
| `--brand-logo-foreground` | Type on the logo plate (light burger) — `#111` / white by logo luminance |
| `--brand-text` | **Readable accent type** on dark canvas / ink plates. Raw brand when light; lifted when dark (luminance &lt; 0.45 → ≥ 0.55) |
| `--brand-highlight` | **Thin accents on light surfaces** (tab underlines, mobile stripe). Raw brand when ≤ 0.45 luminance; darkened when brighter |
| `--brand-foreground` | Type **on** raw brand fills — `#111` or white by the same luminance threshold |
| `--primary` | **Button fills only** (`bg-primary`): Settings `--brand` in both themes |
| `--primary-foreground` | Text/icons on primary fills: `--brand-foreground` (`#111` / white by the same luminance flip as the header logo) |
| `--primary-hover` | Brand plate: darkens in light (`color-mix` toward black); lightens in dark (`color-mix` toward white) |
| `--primary-text` | **Inline accent** on surfaces: ink `#111` in light, `--brand-text` in dark. Use `text-primary-text` for links, icons, selected nav — never brand body text on white |
| `--highlight` | Accent underlines — `--brand-highlight` in light, `--brand-text` in dark |
| `--chip` / `--chip-foreground` | Ink `#111` plate + `--brand-text` — legacy ink chips / badges (segmented tabs and filter pills use solid `--brand`) |
| Nav counters (`brandChipCount`) | Light: mid-grey `#666666` + off-white `#fafafa` type; dark: same mute as unselected filter-pill counts (`foreground/10` + `foreground/70`) |
| `--selection-subtle` / `--selection-subdued` | Hover and selected list rows, header bands |
| `--accent` / `accent/60` | Overlay menus: current value is full `--accent`; hover/focus is `--accent` at 60% (`overlayMenuHover`) so the two never match. Same token in light and dark. |
| `--stat-tile-selected` / `--stat-tile-selected-border` | Interactive `StatTile` summary tabs — white plate (light) / lifted grey (dark); rim via 1px box-shadow only |
| `--ew-stat-tile-selected-face` | Selected StatTile glossy inset face (stronger than `--ew-surface-face`) |
| `--ew-page-panel-face` | Desk `.page-panel` inset face — top/bottom catch only (no left/right stroke) |
| `--canvas` | App shell and sidebar. Light is a cool grey (`oklch` 0.932 / 0.002 / 250), a step under `--page` |
| `--page` | Main desk plate behind Home Summary / Live chart. Light is near-white (`oklch` 0.968). `--surface` / `--card` stay a step lighter (`0.982`) so the canvas → page → card stack holds |
| `--panel-empty` / `--panel-empty-dark` | Empty Back/Lay plate before a bookie or exchange tint. Light is `--page` mixed 96% toward black; dark is `--page` mixed 94% toward white. `@property --panel` initials match these so mounts do not flash zinc grey |
| `--stat-tile-hover-mix` / `--stat-tile-press-mix` | Inactive interactive tile hover / press `color-mix` toward `--stat-tile-selected` |
| `--fab-shadow` | Mobile quick-actions FAB outer drop (hairline + bloom). Layered under the skeuo face via `.quick-actions-fab`. `--page-shadow` is `none` in dark, so the FAB cannot share it |
| `--modal-shadow` | Floating dialog plate drop. Light includes the old `ring-border/50` hairline. Dark is a real bloom (`--page-shadow` is `none`). Applied on `.modal-surface` |
| `--modal-overlay-blur` | Overlay frost (`2px`). Off under `prefers-reduced-transparency` |
| `--border` | Tightened neutral borders (`border-border/80` on cards and tables) |
| `--negative` | Loss P&L + Racing Desk holding/elapsed status. Light = price-tape red (`oklch` 0.62 / 0.205 / 25, ≥ 3:1 on `--page`); dark = lighter red for canvas contrast |
| `--success` | Qualifying / completed / positive eligibility (not P&L) |
| `--profit` | **P&L / “it paid” type** (`text-profit`, `moneyPositiveClass`). Light is a price-tape green (`oklch` 0.585 / 0.16 / 162, ≥ 3:1 on `--page` / `--canvas`) — CoinMarketCap / exchange up-tick, not olive. Dark is the old emerald-400 lift. Do not reuse `--success` for money |
| `--tape-goal` / `--tape-goal-fg` | Fixture tape Goal plate. Fixed `#f5c400` / `#111111` in both themes. Not `--brand` |
| `--warning` | Caution and execution risk only (near-min fields, NR traps, real warnings). Light = mid amber (`oklch` 0.54 / 0.18 / 68) so type and 10% washes stay amber, not khaki. Dark = lifted gold (`oklch` 0.72 / 0.13 / 75) for canvas contrast |
| `--warning-foreground` | Type **on** solid `bg-warning` plates (site banner maintenance, warning FilterPill). White in light, ink in dark, same flip as `--edge-foreground` |
| `--edge` | **Offer Edge / free-bet campaign signature** (violet). Race picks, recommended markers, Edge today, side-nav `Pro` mark (`proNavTag` = same plate as `edgeNavTag`) with `--edge-foreground` on the plate. Also: FB badge, Convert CTA, campaign pipeline **awarded / converting** label + bar (`text-edge` / `bg-edge`). Gift / promo-balance rows may still use historical `violet-*`; Zap there is the shared lightning motif. Marketing Edge plan: mixed rim, shine, and trial button use `--edge`. Choose Core uses `--marketing-brand`. |

Movement / profit uses semantic green/red via `MoneyFlow` - primary is for chrome only.

**Brand on light surfaces.** Brand accent fails contrast as *body type* on white/page. Primary buttons (`bg-primary`) use the raw Settings accent as the fill in both themes, with `--brand-foreground` on the plate (the same `#111` / white threshold as the header logo). Chips stay ink + brand type. Use `text-primary-text` for non-button accent text (links, icons, sublines). Do not use `text-primary` for body copy in light mode.

**Subscription.** Settings → Subscription (first tab, `/settings?tab=subscription`): live plan and status from `app_users` (EDGE-5). A Stripe customer sees **Manage subscription** (`pagePrimary`) into the Customer Portal; return lands on this tab. Complimentary Core/Edge (no Stripe customer) hides the portal button and adds “No Stripe portal.” Tiles keep the grant status. Tab intro stays “Plan, trial and billing.” for every account. Free or cancelled shows two choice plates, not a pair of loose buttons: Core (`quietPanel`) and Edge (`edgePanel`). Each plate title is `Available on {plan} subscription` at `text-base font-semibold` (same string and scale as `PlanLockEmpty`), then `monthlyLabel`, then `SETTINGS_PLAN_HIGHLIGHTS` ticks, then the CTA: **Choose Core** as `pagePrimary`, **Start 14-day Edge trial** as `variant="edge"`. Do not add **Try Edge** or **Walk the desk first** on this tab. Upgrade prompts live on locked desks. If a preview is already on, a bare strip (not a plate) with **Back to Free / Core** exits it. Hidden for Edge subscribers and on the public demo (viewing bar). Clerk is identity only. Do not build a custom card form. Test portal can switch Core↔Edge list prices. Founding is invite-only, not a portal product.

**Appearance.** Settings → Appearance: Light/Dark (`ThemeSelect`), UI font dropdown (`UiFontSelect`: Noto Sans (default), Figtree), header pattern picker (`HeaderPatternSelect`: twelve [Hero Patterns](https://heropatterns.com/) tiles, default Diagonal lines), plus brand accent presets (Amber, Viridian, Coral, Azure, Orchid, Citrine, Rose) and Custom colour picker. Light-mode selected segment uses `--stat-tile-selected` (pure white, the lightest plate) + `foreground` type; dark-mode selected stays `background` + `foreground`. Default keeps next/font on `--font-sans` (Noto); Figtree sets `html[data-font="figtree"]` so `--font-sans` / `--font-heading` resolve to `--font-figtree` (persisted in localStorage, SSR cookie `edgeways-ui-font`, and `AppSettings.uiFont`; FOUC script in `<head>`). Accent apply sets `--brand` plus contrast tokens; swatches show a loader until settle, then the selected style. Non-default accent/font/pattern persist in localStorage, an SSR cookie, and `AppSettings`. Choosing the product defaults (Amber, Noto, diagonal lines) **clears** those stores so a hard refresh paints CSS defaults. Public demo never reads or writes appearance prefs (always Amber + Noto). A blocking head script mirrors localStorage/cookie before paint; brand colour transitions only run after `html.brand-accent-ready` (avoids Amber → selected flash).

**Brand contrast.** Relative luminance threshold `0.45` on the raw brand:

- **On brand fills** (primary / CTA faces in both themes): `--brand-foreground` is white when brand is dark, `#111` when light. Pro / Edge nav marks use `--edge` / `--edge-foreground` instead. Active filter-pill counts do **not** use brand-on-brand — see Filter pills below.
- **As type on dark/ink** (selected nav, chips): `--brand-text` keeps light brands as-is and lightness-lifts dark brands to ≥ 0.55 luminance (saturation unchanged) so Viridian etc. stay readable without going neon. Nav counters use `brandChipCount` (row above), not `--brand-text`.
- **As thin strokes on light surfaces** (line-tab underlines, mobile topbar stripe): `--brand-highlight` keeps mid/dark brands as-is and darkens bright brands to ≤ 0.45 luminance — reverse of the brand-text lift; saturation unchanged.
- **Topbar:** same flip for lockup / inactive meta (`--brand-on-topbar`). Light mode ink plate uses `--brand-logo` for the lockup, Beta plate, **and** burger (`--topbar-accent`) — dark brands are lifted to the brand-text floor (≥ 0.55) so Viridian etc. clear `#111`; inactive meta tabs are white. Burger icon uses `--brand-logo-foreground` (logo-plate luminance — ink once the lift crosses 0.45).

**Pressable buttons (react-3d-button).** `default` / `pagePrimary` / `outline` / `secondary` / `destructive` / `success` on `Button` render through `PressButton` (`components/ui/button-3d.tsx`). Depth is **Shopify-style** (Polaris `shadow-button` via `--ew-btn-shadow`): no chunky extruded colour slab — a 1px inset bottom lip + top shine on the face. Light-mode primary faces share `--ew-chip-shadow` (same soft dark rims as filter pills). Press switches to `--ew-btn-shadow-pressed` and shunts content **0.25px** down. Hover is a **stable** 0.5px content shunt (no left/right skew tracking — that jittered icon+label lock-ups). Ghost / link / `asChild` stay flat (no pack press), but share the same face shadow tokens. **Never put `DialogTrigger asChild` / `PopoverTrigger asChild` on a pressable `Button`** — Radix trigger props force the flat path, so the control ends up taller / differently faced than Press siblings. Use controlled `open` + `Button onClick` (dialogs) or `PopoverAnchor` (DatePicker) instead. Icon + label use a **6px** gap (`0.375rem`) on the pack’s inner content span. Campaign-card outline clusters (`outlineButtonGroup`) must keep every outline `sm` control on the Press path at the same height. Toggle: `toggle` + `active` / `onToggleChange` (Racing Desk Track race / Tracked; success when on). Prefer `size="lg"` (`h-9`) for page-header action clusters. **Disabled** keeps the fill family (primary stays a quiet brand mix, not charcoal) and readable type. Do not stack `opacity: 0.5` on `--muted` / `--secondary`. Shortcut keycaps inherit the label colour so they stay visible on the plate.

**Filter pills & segmented tabs.** Page filters use `<FilterPill>` (`components/ui/filter-pill.tsx`) — PressButton + `rounded="full"`, inactive outline face, active solid `--brand` plate + `--brand-foreground` type (same filled-accent pattern as `tone="edge"` violet). Extra active tones: `profit` (Admin Activity casino), `warning` (maintenance / caution), `ink` (foreground plate, e.g. site-banner Notice). `TabsList variant="segmented"` (e.g. Do next Priority / Edge / Rate) uses the same active brand plate. Do not put `MoneyFlow` `signColor` on a brand segmented trigger: `--profit` / `--negative` fail on `--brand` (Amber and other light accents). Use interactive `StatTile`s for that switcher — see Stat strips. The active fill is a shared sliding plate (`useSlidingIndicator`, same 300ms standard ease as line-tab underlines — no spring) — do not snap a per-trigger background. Per-tab plate colour via `data-plate` on the trigger (`edge`, `ink`; default `--brand`). The track is `bg-muted/60` in light — same idle fill as compact FilterPills (Home chart 24h / 7d chips) — and `dark:bg-input/30`. **Counts** via `filterPillCountState()`: inactive = muted fill; active = ink `#111` + off-white `#fafafa` in both themes so the number stays white on any user brand and on edge violet (never brand-on-brand, brand-on-edge, or dark-mode `--brand-text`). Faces use `--ew-chip-shadow`: soft **white** inset rims in dark mode (nailed — do not change), soft **dark** inset rims in light mode (same geometry, inverted polarity). Ink plates (Login on #111) use `--ew-ink-plate-shadow` instead. Home compact chips share that recipe via `filterPillState()`. Segmented roots use `activationMode="manual"` (arrows move focus; Enter/Space commits) so arrowing does not thrash content. Focus ring is inset (no offset) so the active pill does not balloon in the track.

**Raised fields / chips (skeuo).** Same Shopify face as buttons (`--shadow-skeuo` = `--ew-btn-shadow`). Works on native inputs. Compact `.skeuo-sm` in light keeps a soft bloom; dark chips share `--ew-btn-shadow` with no extra bloom. Plate `#eeeeee`.

**Dark-mode faces.** On dark / ink plates, inset **dark** lips vanish — use soft **light** top + bottom shine (`--ew-btn-shadow` / `--ew-chip-shadow`, ~0.08–0.14 opacity). Light-mode brand plates invert that with softer **dark** rims (~0.05–0.08) so yellow plates don’t read as high-contrast bezels.

**Campaign / Do next cards & modals.** `.offer-campaign-card` / `.modal-surface` use the same glassy Shopify face as ChromeTab plates and chips (`::after` inset: light = rise-tab plate; dark = `--ew-chip-shadow`). Campaign cards keep outer `ring-border/50` in light only (`offerCampaignCardShell`). Dialog plates lift with `--modal-shadow` instead (drop plus that same light hairline). Dark drops the old black-mixed ring so the lighten rims can read. Whole-card hover brightness only via `offerCampaignCardInteractive` when the card has a real open/navigate handler (list → details, calendar tile, Do next). Static embeds (Campaign details modal, history rows, Acca/Systems cards) stay flat — no hover without interaction. Collapsed Details previews stay one line with ellipsis (`campaignCardDetailsSummary`). Campaign details modal actions stay right-aligned (`justify-end`), wrapping onto their own row on narrow widths. **Do next** cards add `.do-next-card`: stronger top bevel + glass wash + soft outer rim (Priority / ChromeTab language at card scale; padding and `rounded-[20px]` unchanged). The Home carousel uses a fixed `300px` width (`doNextCarouselCardWidth`) so one card matches a multi-card strip; the mobile stack stays full width. **Desktop Do next** is a snap strip with trackpad / wheel and overlay circular prev/next (`ScrollFadeEdges stepButtons`, secondary PressButton, `rounded="full"`, `size="icon-sm"`) that sit in the edge fade, only when that direction still has cards. Do not add mouse-drag-to-pan on these cards (glass + snap hitch). Tab strips may still use `dragToScroll`.

**Lifted containers (site-wide).** Cards, `.surface-lift`, bet panels, and `panelSurface` share a **minimal** glassy face via `--ew-surface-face` / `--ew-surface-rim` (softer than chips / Do next — soft top catch, no boxy stroke). Dark drops outer `ring-*` so the face carries the edge. `.page-panel` uses `--ew-page-panel-face` (top/bottom catch only) and `--page-shadow` — no left/right rim or ring, so Home Summary and the rest of the desk plate stay open at the sides. Prefer `panelSurface` over ad-hoc `rounded-xl border bg-card`. Class escape hatch: `.surface-glass`. Ranked items inside a list modal (Race picks) use `dialogTicketSurface` and sit the dialog on `--page` in both themes (`data-dialog-tone=page` + `dark:bg-page`) so `--card` tickets lift. Do not rest `bg-card` tickets on a `dark:bg-card` dialog.

**Alert toasts.** Rest on `--page-shadow`. Hover uses `--toast-shadow-hover` plus the campaign-card brightness lift (`0.98` light / `1.12` dark). Shadow and filter only, no padding or size change.

**Mobile quick-actions FAB.** The floating brand bolt (`.quick-actions-fab`, same `BOLT_PATH` as the mobile top-bar mark) is the one skeuo exception that also takes an outer drop: `--shadow-skeuo` + `--fab-shadow`. Inset face stays Shopify; the drop keeps a brand plate from melting into brand page chrome. Do not flatten it with `shadow-none`. Do not swap the mark for Lucide `Zap` — that icon is boosts only.

**Warning notices.** In-page execution warnings use `<WarningNotice>` (`components/ui/warning-notice.tsx`) on the `warningNotice` token (`surface-styles.ts`): `border-warning/40 bg-warning/10`, title `font-semibold text-warning`, body muted 12px. Same plate as Acca / Bet Builder offer requirements. Softer `warningPanel` (`/25` `/5` + wash) is for tinted cards, not this copy block. `--warning` is for caution and execution risk only. Bold selection names in the body (`<strong>`), not colour alone. When a stake, odds or selection-count field breaks those terms, mark the field itself with `placementFieldWarningClass` (`ring-2 ring-warning/70`) and put the reason in an `OfferRequirementHint` (`text-xs font-medium text-warning`) beside it. Blocked or failed tinted plates use `destructivePanel` (same `/25` `/5` wash as Qualifying / Warning). Neutral inset notes (setup copy, Core upgrade nudge) use `quietPanel`. Edge-tier nudges use `edgePanel`. Onboarding upgrade confirmation uses `successNotice` (`border-success/40 bg-success/10`, no mix-blend wash) with a solid success tick and ink title. Do not use washed `qualifyPanel` plus `text-success` type: that reads muddy in dark.

**Site banner.** Operator-set full-bleed bar above the top bar (`MaintenanceBannerLive` / `MaintenanceBannerView`). Type maps to tokens via `siteBannerPlate` in `surface-styles.ts`, no free colour: **maintenance** `bg-warning text-warning-foreground`, **notice** `bg-foreground text-background`, **offer** `bg-edge text-edge-foreground`. Optional link keeps the plate type colour (underline + currentColor focus ring), never `text-primary-text`. Height is measured into `--layout-site-banner-h` (0 when off) so toasts sit 16px under demo bar + banner + header. First paint is server-rendered when the banner is already on. Open tabs pick up changes from `/api/maintenance` (about 10s, or immediately when the tab becomes visible) and animate with the 200ms `COLLAPSE_EASE` height clip plus a fade. Saving in Admin → Releases publishes to that tab at once. `prefers-reduced-motion` snaps open and closed.

**App update banner.** Same plate language (notice / ink) and the same collapse motion. Sits **above** the operator banner when both are on, so a reload prompt still animates in from the top and the stack height is the combined `--layout-site-banner-h`. A 1px `--canvas` hairline sits between the two bars so matching notice plates do not read as one strip. Auto shows when the desk boot build stamp differs from the current deploy (`VERCEL_DEPLOYMENT_ID` / commit, else `APP_VERSION`). Reload is an in-banner action, inline after the message like the site-banner link. Admin → Releases **App update** is Auto / Off / Force, scoped to this environment: local `/admin` writes SQLite (`maintenance_banner:local`, `app_update:local`); live `/admin` writes the unscoped production keys on Neon. Do not use a local toggle to test the live banner.

**Control radius.** `--radius-button` (global − 2px, 10→8) on buttons, fields, and selects via `fieldControl`. Sm/xs share the same radius. Cards / popovers keep `rounded-lg` (`--radius`).

**Switches.** Same Radix `Switch` everywhere: size, thumb, and motion. `tone="default"` is primary on, muted off. `tone="onPanel"` is black/white opacity on a bookie or exchange tint. `tone="pnl"` is `--profit` on and the same muted off as `onPanel` (never `--negative`). Thumb is white; `--profit-foreground` ink in dark when on so it holds on the lifted green. Use `pnl` only when on/off is a money outcome. Optional extras stay `default` or `onPanel` (Use %, settings). Add bet Early payout and Advanced strip switches are `onPanel` (no green when on).

**Fields.** `fieldControl` (`.skeuo-solid.field-control`) on `Input`, `SelectTrigger`, `VenueSelect`, and field textareas. **Text inputs** rest on `--ew-btn-shadow-pressed` (recessed well). **Dropdowns** rest raised (`--ew-btn-shadow`) and press on click/open. Focus-visible adds the brand ring on the face (4px box-shadow: 2px `--page` gap + 2px `--ring`). Do not crop that ring. A height clip that wraps a field (`CollapseReveal`) keeps a 6px open-state gutter via negative margin plus matching padding so layout does not grow. Do not add visible field padding for the ring, and do not use `overflow-clip-margin` (Chrome and Safari ignore a length). Flush headers on a clipped plate stay `ring-inset`. Don’t use flat `border-input` + `bg-transparent` for new fields.

**Bookie colour.** Compact `VenueSelect` and `<BookieChip>` show an 8px (`size-2`) brand-colour circle left of the name. Exchange dots use `exchangeBrandColor` (Betdaq purple `#7b2d8b`, Smarkets green `#00753a`, Matchbook red `#8a151c`, BetConnect navy `#15213c`), not the bookie map (Betdaq Sportsbook navy). Back/lay **plates** use the exchange cell hexes in `exchanges.ts` (light as given). Dark is the same hue via `muteForDark` (`oklch(from … 0.36 calc(c * 0.3) h)`), so plates stay pastel, not vivid. Bookie plates use the Settings brand the same way. Betdaq Back/Lay are `#FFEFB1` / `#BBE7D3`. Betfair Back/Lay are `#A7D8FF` / `#FBC9D2`. A named exchange as the back venue uses that exchange’s back cell, not the yellow/navy mark. BetConnect is lay-only: hide it from any picker that includes `bookie` (Add bet Back, BookmakerSelect). Empty plate before a tint settles is `--panel-empty` / `--panel-empty-dark` (a step darker than `--page` in light, lighter in dark). First paint stays empty; after two frames the brand shines in top-to-bottom over 50ms (`.bet-panel-shine-fill`). If Back and Lay first-tint together (within 800ms), Lay waits 25ms so the bookie starts first. A later bookie or exchange change shines immediately, no delay. `prefers-reduced-motion` skips the wipe and the delay. Same empty-then-settle on Add bet, Calculators, Dutch legs, and ProfitTable chevrons (chevrons still use the 500ms colour fade). Add bet and calculator Back headers use `VenueBadge` `size="tag"` (`BookmakerSelect tagTrigger`): `px-2 py-0.5 text-[11px] font-bold` uppercase, Settings `brandColor` then the bookie / exchange palette (Betfair yellow from Settings). Add bet and calculator Lay headers use the same compact `VenueSelect` ghost trigger (`ExchangeSelect compact tagTrigger`, `kinds` exchange only). The exchange tag includes the account commission after a double space (`BETDAQ  0%`), not in brackets. There is no separate commission field on the plate or Advanced strip. Calculator money rows match Add bet: Odds left, Stake right (`grid-cols-2`). Early-payout Desk **Scope** picks one bookie, then edits that bookie's early-payout rules. Accounts → Scope is the canonical home. Both use the same `<FormSection>` plate as New offer → Scope. Early payout / Racing headers use the side-nav marks (`Timer`, `HorseRacingIcon`). Sport rules use the Adjust balance row grid: Sport / Lead / remove, then **Add row**. Football lead is 2UP / 1UP FilterPills; other sports are a lead number plus unit. Do not label a catalog guess as “Often 2UP”. Menus and the full venue field use 12px (`size-3`). Colour comes from the wallet `brandColor` / bookie palette. Dots take the existing `pillBorderColor` hairline so pale and near-black brands still read on `--page`. Truncated picker names expose the full string on `title`. Do not shrink the compact mark to 6px.

**Add bet flags.** Left column is the bet story: Label, then **Offer trigger** under Market (the label Zap applies here). Right column is money: Back, then Lay. **Early payout** is a bookie-tint strip under the Back plate: lighter toward white in light, darker toward black in dark. The Back body is `px-4 pt-4` with bottom `1rem + --radius-xl` on every sport, so the last fields clear the rounded corner the same as the side gutter. The strip sits below, not pulled over that padding; the stack fill is the same `rounded-xl` as the Back plate (`color-mix` of `--panel` toward white in light, `--panel-dark` toward black in dark) so it cannot leak at the top corners. Keep the Back plate on one `surface-glass` node when the strip mounts or unmounts. Do not swap the glass onto a new wrapper, or `--panel` interpolates from the @property empty-plate initial and the glass `::after` remounts. The strip is `rounded-b-xl` with `py-4` matching the sides. Strip fields keep the standard outward ring (`CollapseReveal` open gutter; the Back stack is `overflow-visible` so the rounded clip cannot cut the ring). No top stroke. The 1px rim (`.bet-panel-ep-edge`) fades from 0 at the join to `black/10` / `dark:white/6` at the bottom, weaker than the Back `surface-glass` rim. Fields on the strip use the Back `--pi` wells in light. Only dark uses a mix of `--pi-dark` toward black. No column gap. Only on the sport’s match-winner market (football **Match odds**, NBA/NFL/MLB/NHL **Moneyline**, otherwise **Match winner**). Hidden on handicap, totals, and other markets. Generic name, not “2UP early payout”. Off is a `tone="onPanel"` switch (black/white opacity on the bookie tint, no green). **Advanced** is the same strip under the Lay plate (exchange `--panel`, same rim and mix as Early payout). Keep that Lay plate on one `surface-glass` node. Part-lay odds and stake use compact `h-9` `--pi` wells (`density="compact"`) with compact inset steppers, not the plate `h-11`. Min/max stay `h-7`. The strip remaps `--pi` / `--pi-dark` a step toward black so wells sit on the darker Advanced tint (same dark mix as Early payout). The remove control sits in a third auto column so it cannot squeeze the stake steppers out of the box. Early payout and Advanced flags sit left (`AddBetStripHeader`): icon, label, then the `tone="onPanel"` switch, 12px between label and toggle. **Balance** sits full width under Back odds and Back stake (`BackBookieBalanceStrip`), and the same well sits under Lay odds and Lay stake for the selected exchange (`ExchangeBalanceWell`). The cash well is a light wash (`black/5` + `black/70` in light, `white/10` + `white/80` in dark), not a grey plate. Both the primary and the secondary cash row use that recipe. The wallet line stays for a selected bookie or exchange. Do not show “Stake £X of £Y available” when the stake fits. Only an underfunded bookie stake shows **Exceeds balance** (or **Exceeds free bet balance**) under that well, with **Add £X.00 to cover** on the same row, where X is the top-up (`bookieCashTopUpNeeded`). An underfunded exchange lay shows **Exceeds balance** under the exchange well, plus helper “Top up your exchange to fund this bet.” (same style as the Advanced empty hint). No add-to-cover checkbox on the lay side. Header chip is the compact exchange ghost tag. Body is Lay odds | Lay stake. Use % stays the generic switch. **Mug bet** is a standard checkbox on the Bet type label row (tooltip: “Real money, excluded from edge metrics”), not on a money strip and not next to Save. On + football is a 2UP / 1UP select (default 2UP, helper “Paid when 2 goals ahead”). On + other sports is the lead number plus unit only, no second “Paid when” line. Save bet writes that rule to the bookie's Scope. Do not interrupt with a second Scope dialog. Switching sport always turns Early payout off (lead then reloads from Scope for the new sport). Darts pays by sets, same as tennis. On + matched lay, ProfitTable adds a third row (If 2UP, and lay wins, or the sport’s lead rule) under the two ordinary outcomes. Chevron is `--edge`. No row wash. Qualifying loss ignores that row. **Mug bet** is a Bet type under Risk-free: qualifying maths, saved `purpose` mug. Not a checkbox on the slip. Early payout extras and Advanced lay reveal with `CollapseReveal` (200ms `COLLAPSE_EASE` height + spring fade).

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
site banner + header). Page height subtracts `--layout-below-header` so the desk still fills
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

1. **`AppTopBarHeader`** — lockup, bankroll stacks, burger (mobile). The hang
   tab paints on first chrome, using the last session snapshot
   (`src/lib/chrome-snapshot.ts`, `CHROME_SNAPSHOT_KEY`) when `/api/state`
   has not arrived yet. Do not hide it until the live desk loads. Fixed `h-14` so the
   balance pill can collapse without reflowing the page. Below `md`, the lockup sits in a
   `@container/brand` leftover slot: wordmark when that slot is at least `13.5rem`
   (wordmark + Beta + inset, plus a little air), otherwise the bolt (Beta stays). The
   hang tab and burger shrink the slot, so the fallback is a collision, not a
   `sm` breakpoint. The Demo data badge is `sm+` only, because it does not fit
   beside the hang tab on a phone. `md+` keeps the wordmark in the nav column. Desktop (`sm+`) balances
   sit in `ChromeTab edge="hang"`, top-aligned. A 12px bottom strip (chevron up)
   collapses metrics upward with `COLLAPSE_EASE` height + spring fade
   (`lib/ui/motion.ts`); collapsed keeps a short “Show balances” + chevron-down
   reveal (`localStorage`). **Mobile (`< sm`):** no chevron and no collapse. The
   whole hang tab is one tap target (min 52px) and opens `MobileBalancesDialog`,
   a bottom sheet with segmented **Balances** / **Free bets** tabs. Profit and
   Free bets rows in that sheet are 44px targets (tracker, or the Free bets tab).
   The hang pill is always 2×2: Profit + Free bets on
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
  section nav + the meta links. 12px (`--layout-meta-nav-gap`) sits above the
  strip so the tabs clear the hang balance pill. Desktop keeps the gap at 0.
  `--layout-header-h` includes the gap so page height and toast offset stay
  aligned. Toasts stay top-right at every breakpoint, sitting 16px under that
  offset. **Admin** uses `--admin-below-header` (stripe + `h-14`, plus the
  mobile nav strip below `md`) instead of the desk token, still 16px under
  the chrome. On viewports ≤600px they cap at `--overlay-max` so they read as a
  card, not a full-bleed banner. Do not let Sonner stretch them full-width.

## Page headers

**`DeskPageHeader`** (`src/components/layout/desk-page-header.tsx`) - title band on `sectionBar` background, optional description, help `?`, action slot, optional toolbar.

**`PageHeader`** (`src/components/help/page-header.tsx`) wraps `DeskPageHeader` with a bordered shell. Use on all main app pages.

**Header stats + CTAs** - pair `PageHeaderStatGroup` with `PageHeaderButtonGroup` inside
`PageHeaderActions className="gap-6"` (24px between supporting text and the contained button
cluster). Stats stay at 8px; buttons inside the cluster stay at 8px.

**Mobile stacking.** Below `md`, the action slot sits under the title and description, full
width. Do not keep CTAs on the same row as the heading: `flex-1` plus `min-w-0` on the copy
lets the title shrink into the buttons. From `md` up, title left / actions right, `items-start`.
Keep the description to one short sentence. Description type uses `pageDescription`
(`text-sm` / 14px), not `sectionDescription` (`text-xs`).

**Calendar day stepper** - `CalendarDayStepper` (`src/components/calendar-day-stepper.tsx`)
is the prev / date / next control on Admin Activity and Fixtures. Outline
`toolbarIconBox` chevrons (`size-8`) frame one outline `DatePicker`, with
`gap-1` (4px) between each chevron and the date field. Height is
`toolbarControlH` (`h-8` at every breakpoint). Width is
`calendarDayStepperTriggerWidth` (`10.75rem`, year labels included). Horizontal
pad stays `px-2` on every breakpoint (no form-field `max-sm:px-3.5`). Compact
`selectedLabel`: Today / Tomorrow /
Yesterday, else `d MMM`, plus the year when it is not this year. Pass `min` /
`max` as YYYY-MM-DD so arrows and the calendar share the same bounds.
Fixtures: lookback 6 days through tomorrow. Admin mix: two years back through
today.

**Admin Activity board.** Stats stay in the header strip, not inside widgets.
Half-width pins and desk activity are matching Cards, top-aligned
(`lg:items-start`). Full-width volume, categories, and per desk sit below.
Focus pills Pins / Volume / Mix rewrite the order. Arrange moves widgets and
saves a custom order; a Custom pill shows while that order is active. Cookie
`ew_admin_activity_board` (this browser, `/admin` only). Default focus is Pins
so a new feature can sit above the fold beside the activity line. Compact plot
height is `--layout-admin-chart-compact-h` (`adminChartPlotCompact`); pin table
cap is `--layout-admin-table-compact-max-h`. Full plot is `--layout-admin-chart-h`.

**Fixtures chrome** - Flashscore-style tape, not a card inside a card. The
page title is **Fixtures** plus one short sentence. The pin rail is a
separate column on the **right**. Sport line tabs (`TabsLineBar`) and the feed bar span
the **padded page column** (`--layout-page-x`, same axis as Profit
Tracker). The hairline is full width of that column, not the raw panel
edge; tab labels line up with **Fixtures**. No hairline under the title;
16px (`mt-4`) sits above the sport tabs. Title, tabs and feed bar stay
pinned; the pin rail stays put and the tape scrolls in `ScrollFadeEdges`
(`from-page` top and bottom, matching `--page`, `fadeOnScroll` so the
washes appear only while the list is moving). Tape and pin rail
scrollers use `my-4` (16px, same as the card row gutter / `deskInsetX`)
so the thumb starts on the first card, not the empty pad above.
Fades are sticky inside the scroller so the thumb paints over them. Gap
between tape and pin rail matches `--layout-page-x` (same as rail to
page edge). A 1px top hairline spans the tape and the pin rail; cards
and pins scroll under it. List desks that pin chrome (Tracked Events,
History, Alerts, Campaigns, Casino Campaigns) use `PageFillShell` +
`PageFillScroll`. Feed bar: All / Live /
Scheduled FilterPills left (`overflow-x-auto overflow-y-clip` +
`app-scroll-overlay` so hover never paints a vertical scrollbar);
right cluster is `CalendarDayStepper` then
an outline **Filter** icon (`ListFilter`, `toolbarIconBox`) with `gap-2`
(8px) from the next-day chevron. Icon only, never the competition name.
On Early-payout Desk (`/early-payout` Fixtures, 2UP picks, Tracked) the five
summary tiles stay in one strip (same as Active / Model and Racing
Desk). On `lg` the pin rail is one StatStrip column wide (the rightmost
card) with `--layout-page-x` between tape and rail, same gutter as
Fixtures. Day stepper and Filter
sit in one row at the top of that rail: previous day, Today, next day,
then the Filter icon (`gap-2` after the next-day chevron). The empty
feed bar is omitted. Below `lg` day + Filter stay on the feed bar with
the Pinned popover. The Fixtures page itself is unchanged (`w-56` rail).
When a competition or course is selected the icon uses the selection
plate (`border-selection-subdued-border` / `bg-selection-subdued`). That icon stays on the feed bar at every
width. Day changes that are already warm (today / tomorrow after the
first load) paint at once. A cold day clears the tape and shows the
page loading empty until that sport's list arrives. The Filter icon
does not spin. No Competition / Time segment.
The tape is always grouped by competition. Football headers are
`COUNTRY - League` (`ENGLAND - Championship`): country and name share
`sectionTitle` (same size and colour). That country prefix is **header
only**. Pin rail, filter menu, and empty-state copy use the competition
name (`Championship`). World / worldwide titles stay bare. Racing
headers use the same `REGION - COURSE` split. Pin and collapse chevron
are `size-8` in a `p-2.5` band, so the pin has equal left / top / bottom
inset and the chevron has the same on the right. 8px (`pr-2`) sits
right of the pin. On Edge, an unpinned football pin tooltip is
`Pin {competition} to see odds`. Unpin stays `Unpin {competition}`.
The flag sits `gap-2`
(8px) left of the title. A collapsed header shows the count `12px`
(`gap-3`) after the competition name, not beside the chevron:
live as `N Live` in `text-profit`, then a muted count for scheduled and
finished (`2 Live · 3`). No count when the group is open. Country flags are `RegionFlag` only (colour-emoji set, same
as Mexico). Do not use API-Football flag images or crests for countries.
`RegionFlag` forces a colour-emoji face so UI fonts cannot paint boxed
letters. Map Russia to `RU` (Intl still labels withdrawn `SU` as Russia). On All, common UK / European
leagues sit first (Premier League, Championship, then Serie A, La Liga,
Bundesliga, Ligue 1, Eredivisie), then the rest. Inside each band, and
for Racing, order competitions / courses by the first kick-off
(Flashscore). A named pin or Pinned only only lists competitions / courses that have
a match that day. If Pinned only has none, one page empty:
“No fixtures for your pins” (racing: races), plus secondary **Show all**.
The pin rail (`w-56`) is reserved on first paint (spinner in the
column) so it does not jump in after `/api/state`. After settings land
it only stays when the desk has pins or a backed card: All / Pinned only
+ pin shortcuts in the **saved pin order** (not that day's kick-off),
under a Competitions / Courses caption (`mt-4` / 16px above the caption).
**Backed only** appears under Pinned only only when a fixture (or race)
on this day has a desk back; hide it at 0. Pins
show the competition name only (flag carries country) at `text-sm`
(same as the app nav), counts at `text-xs`. When there are
two or more pins, muted `Drag to reorder.` sits under the list. The rail paints the same selection plate
as All / Pinned only when a competition is the active filter. No pins:
hide the rail. The feed-bar Filter icon is the only
competition / course picker on Fixtures. Do not duplicate it on that
rail. Early-payout Desk moves Filter onto the rail with the day
stepper (see above). Below `lg`, Pinned is a pins-only popover when there are pins. Title, tabs, the feed bar and the pin rail stay pinned; only the tape scrolls.
Browse fixtures uses the same chrome. Football tape rows follow
Sofascore: kick-off on the left. Live, upcoming and finished share
the same plain clock column (kick-off, with the minute under it when
live). No well, no dash, no FT copy. Score sits left of the crests
(live red / FT muted board). Upcoming has no score slot, so crests
sit left against the clock. Exchange backs sit left of the Radio. No Odds
FilterPill. No Teams / Odds / Score / Track column
headers. Stacked teams use `text-sm`,
`gap-y-1.5`. Betfair backs sit in `fixtureTapeOddsCol` (3.75rem). The
TV board fills the name-stack height: `text-sm` / `font-black`,
`px-2 py-px`
cells so the board matches the odds-row height. Each name, score and
odds line floors at `min-h-6` (`fixtureTapeLineMin`). Odds chips are
`h-6` with no vertical pad, so kick-off-only rows match rows with
backs. Odds chips use
`fixtureTapeOddsStack` (same `grid-rows-2 gap-y-1.5` as the names).
Live is `--tape-score-live` red with white figures in both
themes, no outer ring. A Goal paints `--tape-goal` (`#f5c400`) with
`--tape-goal-fg` (`#111111`) on that cell only — fixed, not `--brand`.
Finished uses `bg-muted-foreground` in light (not chip ink)
and a grey-white plate in dark (`bg-foreground`, `text-page`,
`muted-foreground/55` ring). 8px
(`pr-2`) sits between the board and the crests. The 1px rule between
scores is `fg/20` on live red and `fg/12` on FT (light),
`muted-foreground/55` on FT in dark. Upcoming
without exchange backs leave the price rail empty so the Radio does
not shift. Do not put the score under Odds. Pinned matches on Edge
show Betfair match-odds backs, stacked home over away, using
`ExchangeBackStack` (same `oddsCellStyle` cell as Home → Live →
Events). When a stored match-odds back moves by a displayed tick, the
cell uses the same green/red flash and last-direction chevron as Home →
Live. First paint does not flash. Hide a
side when that back is missing (en dash). Do not fetch the exchange
from the tape; read the scout store on a 20s poll. The list Radio
(`TrackToggleButton`, ghost icon) shows on upcoming and live rows.
Finished rows never show Track. Outline Radio adds the match, the same
stroke in `text-highlight` removes it. Idle is `muted-foreground/55` in
light (`muted-foreground` in dark). Do not fill the glyph. Do not use a PressButton success toggle here (that
pattern is Racing Desk). Tooltip and `aria-label` are Track / Untrack.
The match-events footer Radio matches the tape (upcoming and live;
Track / Tracked, hover Untrack). Add bet and 2UP Desk stay on that
footer.
Pinned football groups (Edge) keep the same kick-off-left tape as
every other football group.
The 2UP hint sits beside both team names: a
five-step tick meter (one Skip, two Thin, three Fair, four Strong).
Each side uses that side's windfall (go two ahead, then fail to win),
not a duplicated match-shape score. Home ticks can differ from away.
Do not put the % on the tape. It lives in the match 2UP tab. Ticks are
glance chrome, not tab stops. Every football name line reserves the tick
slot (`TWOUP_TICK_SIZE.list` / `TwoupFitTickSlot`) so live, finished and
upcoming rows share the odds-row height. Scout load cannot change row
height. Both sides' fit rides on the existing
Open match events control. Hover tooltip on fine pointers only. The whole mark is one traffic-light colour, not a rainbow per bar:
Skip `--destructive` (red), Thin `--warning` (amber), Fair `--brand`
(yellow), Strong `--success` (green). Ghost ticks stay at 20% of that
colour. Do not use `--profit` on this chrome. A Fair
or Strong take shows the same `edgeNavTag` **Edge** mark as Racing Desk
recommended runners, to the **right** of the ticks. A team with a desk
back (not tracked-only, not lay-only or lock-in) shows the same
`backedNavTag` **Backed** mark as Racing Desk runners, at the **end** of
the name line (after ticks, after Edge when both show). The check stays
left of Backed. Backed follows the bet's current selection, not the
first pick or leftover dutch legs. Edge Fair fills
four of five ticks in `text-edge/70`; Edge Strong fills all five in
`text-edge`. Football filters add **2UP picks** (`tone="edge"`,
Zap + count, locked Lock + Edge like Race picks): upcoming pinned
matches with an Edge take, ranked by windfall. Opening a match on Edge adds a **2UP** line
tab beside Commentary and Lineup. The tab ticks are the take side
(`TWOUP_TICK_SIZE.list`). Do not put an Edge pill or flame on the tab.
Loading, empty and error on that tab use `EmptyState`, same as commentary.
Racing keeps `fixtureTapeRowGrid` (clock, copy, icon actions). Competition
groups put no extra pad above or below the row list (`0px`). Competition
headers use `p-2.5` (10px) so the pin and collapse chevron share the
same inset.
Racing tape rows use `py-2.5`. Football match rows use
`fixtureTapeFootballRow` (`py-2.5`) so the tape stays dense; the 24px
line floor keeps names, ticks and chips off the dividers. Hover is `hover:bg-selection-subdued`
(`dark:hover:bg-selection-subtle`) so the wash reads on the light
`selection-subtle` well. Competition headers rest on the same `--card` plate as the rows
(`bg-transparent` on `surface-lift`). A hairline, not a grey fill,
splits title from tape. Hover matches the rows
(`hover:bg-selection-subdued`, `dark:hover:bg-selection-subtle`).
Dark keeps a selection wash on the header. Football home / away name lines use `text-sm` and `leading-normal` (~21px) with `gap-y-1.5` (6px). Do not use `leading-none` on those names: `truncate` clips g/y. Finished matches step the winning name one weight up (`font-semibold`) and the losing name one down (`font-normal`). A draw keeps both at `font-medium`. The match-events header does the same step from its `font-semibold` base (`font-bold` / `font-medium`). Live and upcoming stay even. Live minute uses `text-profit` under the kick-off,
no pulsing Radio. Half-time is `HT` and full time is `FT` only
when API-Football `status.short` is HT or FT (or the stored
`matchEnding`). Do not infer them from the minute. Do not put a
Live pill on the title line. A football row opens the commentary and
lineup modal (`FootballLiveTapeDialog`), with the existing loading
empty-state while tape loads. Edge desks add a **2UP** line tab after
Lineup. The tab ticks are the take side. Do not put a flame icon or
Edge pill on the tab. The dialog opens on Commentary. The 2UP panel has one verdict plate,
then a quiet compare table, then muted match prices. The verdict is
the only loud block: `Take 2UP on {team}` or `Skip this match`, take word
(Strong / Fair / Weak take), and `Pays in n% of matches`. Do not say
fit, Thin, or windfall in customer copy. No ticks, no Home / Away
label, and no pointer on the plate. Win prices sit under the
scoreboard team names (`text-base`) in the same Betfair `ExchangeBackCell`
as the fixture tape, not in the compare table. The
take name uses `text-primary-text` in that header. Compare columns
are Home / Away only. The loaded 2UP tab does not scroll; it must
fit the dialog well. Fair or Strong uses `qualifyPanel` plus the Edge mark.
Weak and Skip stay on `quietPanel`. Fair and Strong words use
`text-primary-text`, not raw `--brand` or `--success`. Compare is home left, away
right: 2UP pays, go two ahead, fail from 2 up. Take figures are
semibold, the other side is muted. No second ticks, no bars, no
“Take 2UP here”. Markets (Over 2.5, BTTS, xG) stay muted. Do
not name a favourite. One `DialogExplainer` on the verdict, one
on markets. No essay. On `sm+` the plate is a fixed 4:5 card
(`40rem` tall at `max-w-lg`, clamped to `85dvh`) so Commentary and
Lineup share one height. A pinned `DialogFooter` keeps **Track**
(outline Radio, upcoming only) and **Add bet** (page primary) on screen
while the tape scrolls. Live and finished football hide Track. Finished
football matches and racing results hide Add bet. Tracked upcoming
matches keep the same control: coloured Radio (`text-highlight`),
Tracked, hover Untrack. Same stroke weight as Track.
Live-view Add bet
(`liveView*AddBetPrefill`) links the feed card and only tracks when the
bet is saved. Racing also sets `raceExternalId` so Events selects the
card, not only the label. Racing clock sits
left of the race name plus runners line (time / Off / Result),
left-aligned in `fixtureTapeClockCol` (3.25rem floor, grows for Result).
A racing row opens `RacingResultTapeDialog` at the
same plate size: course, race, clock, then Pos / Horse / Dist / SP
from the shared results store. SP is decimal (`2.25 F`), not fractional. The tape start fade shows only after
scroll (`pinScrollStart`).

**Ending date/time shortcuts** - expiry fields pass `shortcuts="ending"` to `DatePicker`
(Tomorrow, 7 days), `TimePicker` / `EventTimeInput` (End of day → `23:59`), and the combined
`DateTimePicker` (Tomorrow + 7 days under the calendar, End of day under the wheels). Compact
`FilterPill` chips sit under the calendar / wheels. `DateTimePicker` is wider than the default
18rem popover (calendar + time wheels) and caps at `--overlay-datetime-max`
(`min(26rem, 100vw − gutter)`) and available height, with Clear / Today / Done pinned so they
stay on-screen. Collision padding matches `--overlay-gutter` (16px).

**Native date / time on touch.** `DatePicker`, `TimePicker` / `EventTimeInput`, and
`DateTimePicker` keep the calendar and iOS-style wheels on fine-pointer `md+` desks.
On `(any-pointer: coarse)`, `(hover: none)`, or below `md` they use the OS pickers
(`type="date"`, `type="time"`, `type="datetime-local"`) behind the same field chrome.
That gate is shared (`usePrefersNativePicker`) so Add bet, Offers, Casino, reminders,
Racing Desk, Fixtures, Tracked Events, Profit Tracker, Acca / Systems / Bet Builder,
and free-bet expiry all behave the same. Custom wheels inside a dialog popover cannot
scroll on iOS/Android (scroll lock). Ending chips stay visible under the native field.
Display labels still use `d MMM yyyy` and `formatClockString`. Do not add a raw
`type="date"` / `type="time"` / `type="datetime-local"` input in a form.

**Modal headers** - every working-tool `Dialog` uses the Adjust balance band: `dialogHeaderBand` / `dialogTitle` / `dialogDescription` in `surface-styles.ts` (baked into `DialogHeader`, `DialogTitle`, `DialogDescription`). Title is 20px (`text-xl`) extrabold; the matching title icon is `dialogTitleIcon` (`size-5`). Prefer a short description; when a name or sentence needs more room it **wraps** inside the header (`text-pretty break-words`) — never truncate or overflow the modal. Extra help uses `DialogExplainer` (CircleHelp popover) immediately after the description text, not pinned to the trailing edge of the header. Not a second task. Footer actions stay fully visible (`flex-wrap`). Do not restyle a header with `text-base` or drop the hairline. `p-0` shells cancel the default bleed with `mx-0 mt-0` on the header. Browse fixtures is the exception: drop the header hairline (`border-b-0`) because the Football / Racing tab strip immediately below carries the rule, and pin the plate with `sm:top-20 sm:bottom-20` (80px viewport gutter). The football match-events dialog keeps that hairline band and puts the scoreboard in it (sr-only title); do not flatten the band to drop the rule. While a modal is open, `/api/state` polling pauses so live desk paints cannot flash through the overlay. The overlay is a stable dim (`bg-black/20`) plus `--modal-overlay-blur` (`2px`). Do not raise that blur. `prefers-reduced-transparency` drops the frost and keeps the dim. The plate lifts with `--modal-shadow` (not `--page-shadow`). The burger drawer keeps its heavier `bg-black/40` scrim.

**Adjust balance rows.** Mode tabs are hugging segmented pills (`w-max`) with Top up / Withdraw / Adjust icons. Idle icon colour is semantic (`text-profit` / `text-negative` / muted); the active plate stays brand. Switching mode keeps the rows (account, amount, note, type). Row fields share one header on `sm+` and a fixed CSS grid (`minmax(0, …fr)`) so long account names truncate rather than shifting Type / Amount / Note. Per-row labels stay visible on mobile cards. Include in P&L lives in the footer (not under the last row) and applies to every cash row. When it is on, the footer headline is Profit or Loss. Per-row amounts stay on the form, not repeated under the total.

**Graphic dialog header** - promotional interrupts only (Refer a friend). Replace the hairline band with a `bg-edge` art plate (`text-edge-foreground`). Illustration: slip in `currentColor`, marks in `--edge`, sized `h-[6.5rem] max-w-[15rem]`. Supporting plate copy stays at full or `/85` `text-edge-foreground` (not `/70`). Code well is `bg-edge-foreground/12`; the CTA is a ghost button inverted to `bg-edge-foreground text-edge` (not the brand 3d primary), with `dark:hover` pinned to the same plate so ghost mute cannot leak. Both share `h-11` and `--radius-button`. Body is a two-up settlement, not a checklist: They / You as columns, `captionHeading` + StatTile-scale figures in `text-edge`, dashed `--edge` tear at `/60`. Body and footer stay on the normal modal surface. Do not use this on working-tool dialogs (Adjust balance, Add bet, settle).

**Tooltips.** Prefer short copy. That is content guidance only — when a name or sentence needs more room the tooltip **wraps** (`text-pretty break-words` on `TooltipContent`). Never `truncate`, `whitespace-nowrap`, or `line-clamp-1` inside a tooltip. Chart marker labels follow the same rule. Overlay width is capped at `--overlay-max` (`min(20rem, 100vw − 1rem)`). Row-action icon tooltips sit **above** the control (`side="top"` on `TooltipContent`, the primitive default). Do not pin them left of a trailing action cluster. Tooltip plates use `z-[80]` so they paint above popovers (`z-[70]`); do not drop them to `z-50`.

**Chart markers.** Home / Racing P&L dots use win / loss / neutral (`chart-bet-marker--win|loss|neutral`) and, for money moves, the up / down triangles. Count charts that are not P&L (Admin Activity) use kind tones instead: `--brand-highlight` bets in light / `--brand` in dark, `--edge` sports offers, `--profit` casino (`chart-bet-marker--brand|edge|profit`). Do not reuse win/loss on a volume line. Marker labels wrap like other tooltips. Admin activity markers are tooltip-only (no link into another desk, not in the tab order). Focus-visible uses `--ring`. Hover scale respects `prefers-reduced-motion`.

**Overflow (go-live gate).** Nothing may paint outside the viewport or its containing plate. This is a launch blocker.

- **Wrap first.** Titles, descriptions, tooltip/popover copy, and dialog headers use `min-w-0 text-pretty break-words`. Short copy is guidance, not a nowrap mandate.
- **Focus rings are not overflow.** Field rings paint 4px outside the face. A height clip that wraps a field uses the `CollapseReveal` open gutter (6px negative margin + padding), not extra field padding and not `overflow-clip-margin`. Do not put `overflow-hidden` on a rounded plate that sits flush with a field. Image crops, tickets, and NumberFlow shells may still use `overflow-hidden`. Flush disclosure headers stay `ring-inset`.
- **Contain, then scroll.** Tables and chip rows may scroll *inside* their plate (`overflow-x-auto` + `min-w-0 max-w-full`). Page-level horizontal scroll is forbidden.
- **Flex children shrink.** Any `flex-1` / row child that holds copy needs `min-w-0` or it will blow the page.
- **Overlays stay on-screen.** Tooltip, popover, dropdown, and toast cap at `calc(100vw − var(--overlay-gutter))` and wrap. Do not give them a raw `w-*` without a viewport max. `DateTimePicker` uses `--overlay-datetime-max` so the plate wraps both columns; it still uses that viewport cap, plus available height so Done stays on-screen.
- **Select menus hug content by default.** Popper `SelectContent` is `w-max`, never narrower than the trigger, capped at the tighter of Radix available width and `calc(100vw − var(--overlay-gutter))`. Names, type badges, balances, and other identity UI must stay fully readable. Do not pin every select to the trigger. Truncation is for title-style copy only.
- **Overlay hover is weaker than selected.** Select and dropdown items use `overlayMenuHover` (`bg-accent/60`) for hover/keyboard focus. The current value (`data-[state=checked]` on `SelectItemRow`, open submenu) stays full `--accent`. Do not paint hover and selected with the same fill.
- **`matchTrigger` is opt-in.** Use it only on full-width title lists (offer Race). Then the menu matches the field, the title truncates via `SelectItemRow`, and trailing meta (runner count) stays `shrink-0` on the right. Never use `matchTrigger` on Account, venue, exchange, or other pickers where the label is how the user identifies the row.
- **Clip the shell.** `html` / `body` / `.app-scroll` / `PageShell` use `overflow-x: clip`. Do not remove that to “fix” a wide child — fix the child. Nested panels that must show a standing scrollbar use `.app-scroll-always` (same thin thumb as the page shell). Overlay a thumb on the content with no track or gutter via `.app-scroll-float` plus `ScrollFadeEdges overlayScrollbar` (match-events tape).
- **Scrollbars appear only while scrolling.** The page shell (`.app-scroll`) keeps a stable gutter and paints the thin thumb only while that scroller moves (`data-scrolling`), then hides after a short idle. Nested WebKit bars stay width 0 so full-bleed rows never reflow; Firefox may colour a thin overlay thumb. Hover must not paint a standing bar. `.app-scroll-always` stays visible. `.app-scroll-overlay` stays hidden. Floating tape thumbs follow the same scroll-only reveal. `ScrollIdleBars` in the root layout owns the attribute.
- **Fade clipped scroll.** Any nested region that scrolls (dialog body, max-height panel, card list, tab strip, select/dropdown/command list) uses `ScrollFadeEdges` (`src/components/ui/scroll-fade-edges.tsx`). Soft start/end fades appear only while more content is clipped. Page tapes that must stay crisp at rest pass `fadeOnScroll` (same idle as overlay thumbs). Washes sit 1px over the seam (`-top-px` / `-bottom-px` / `-left-px` / `-right-px`, `FADE_SEAM_PX`) so fractional zoom cannot leak a sliver. `edgeRule` adds a 1px hairline at `z-[2]`; the wash stays at `-top-px` / `z-[1]` so the rule never opens a zoom gap. Sibling headers stay above the wash (`z-10`). Do not clip the fade wrapper. Vertical is the default; tab strips and card decks use `orientation="horizontal"`. Pass `fadeClassName` to match the surface (`from-page`, `from-background`, `from-card`, `from-popover`, `from-page dark:from-card`, …). Nested thumbs stay on `.app-scroll-nested` / `.app-scroll-overlay` via `scrollClassName`. Do **not** invent a second mask or a one-off gradient. Card decks that snap (Home Do next) pass `stepButtons` for overlay prev/next; those are not a second fade. Radix Select must not render scroll chevrons: they remount on first scroll and jump the list. Overlay fades with `scrollAsChild` on the Viewport instead. Pass `startFade={false}` when a sticky section header already occludes the leading edge (Match events period bars, Home Live feed `ListDayRule`, mobile Home deck cards). Exempt: the page-level `.app-scroll` shell, and time wheels (those keep their existing mask).
- List-row `truncate` is allowed only on fixed-height chrome (nav, feed rows, select items) where the full string is available elsewhere (trigger, `title`, or another surface). Never use it as the overflow strategy for tooltips, dialogs, or page titles.

**`CalculatorPageHeader`** - borderless meta band for calculator shells.

**`ToolbarRow`** - filter pills and secondary controls below the title band (`sectionMeta` background).

## Type scale floor (micro copy)

Compact sports-desk density is fine; **illegible micro type is not**.

| Role | Preferred | Absolute minimum |
|------|-----------|------------------|
| Page header description (`pageDescription`) | **14px** (`text-sm`) | 14px |
| XSmall / captions / dense meta | **12px** (`text-xs`) | 11px (`text-[11px]`) |
| Inline icons in text lock-ups at this scale | match type (~12px / `size-3`) | 11px |

**Do not use 10px or smaller** for UI copy, badges, counters, table captions, or tier tags (`text-[10px]`, `text-[9px]`, etc.). Prefer shared tokens in `src/lib/ui/surface-styles.ts` (`pageDescription`, `sectionDescription`, `captionHeading`, `tableHeaderCell`, `filterPillState`, `brandChipCount`, `navTag` / `proNavTag` / `edgeNavTag` / `demoDataTag`) over one-off pixel sizes.

When bumping micro labels, bump sibling lock-up icons (`size-2.5` → `size-3`) so the pair stays balanced. Decorative chrome (tooltip arrows, wheel gutters) is exempt.

## Stat strips

**`StatStrip`** + **`StatTile`** (`src/components/layout/stat-strip.tsx`) - 2–5 column grid of compact metric tiles. Used on Racing Desk, Edge Report, Settings → Subscription, and the Home / Tracker Pace dialog. Racing Desk **Racing P&L today** puts the race breakdown on the left and the day chart on the right from `lg` up (chart stays first on a phone). Nested in a `Card`, idle tiles sink to `--page` so they still plate against `bg-card`. That fill lives in `globals.css` on `[data-slot="card"] .surface-lift[data-stat-tile]` (not `in-data-[slot=card]:bg-page`) so it beats `.surface-lift` `background-color` and stays out of the selected-tab fill. Hover and press only apply when `aria-pressed` is present (interactive tabs). In a working-tool dialog that shows P&L on the switcher itself, use interactive `StatTile`s (neutral `--stat-tile-selected`), not brand segmented tabs. Sit that sheet on `data-dialog-tone=page` + `dark:bg-page` so idle tiles lift. A two-metric dialog strip may force `grid-cols-2` so both figures stay visible in a narrow sheet (default `StatStrip` stacks until `sm`).

**Density.** `px-4 py-4`, fixed three-row stack (label / value / sub — sub slot reserved by default so mixed strips share height). Pass `reserveSub={false}` to drop the empty sub row (Accounts bookie Cash / Free bets). Label and sub: `text-[11px]` uppercase / muted; value: `text-2xl` bold tabular. Settings → Subscription passes `valueClassName` (`text-lg`) so a status chip can sit beside the plan name.

**Interactive tiles** (`onClick` + `active`) are summary tabs: selected fill `--stat-tile-selected` (white in light, lifted grey in dark) with `--ew-stat-tile-selected-face` and a single 1px shadow rim (`--stat-tile-selected-border`). Fill/face live in `globals.css` on `.surface-lift[data-stat-tile][aria-pressed="true"]` so they beat the shared surface background utility; selected also drops the default `surfaceLift` ring. Focus uses `ring-brand/60`. Non-interactive tiles stay on the default surface plate.

## Tabs

Page section navigation (Settings, Profit Tracker, Fixtures, Racing Desk courses) uses
**underline line tabs**: `TabsList variant="line"` inside `TabsLineBar`
(`src/components/ui/tabs.tsx`). Active tab is bold with a brand underline
(`--highlight` → `--brand-highlight` in light) on a full-width hairline, not a filled pill.
The sliding plate (segmented) and underline (line) both use `tabSlideTransition`
(300ms `ease-in-out` / `cubic-bezier(0.4, 0, 0.2, 1)`) — Material standard ease,
no spring overshoot. Animate with `translate3d` + `width`, never `left` (that
jitters on the longer Priority → Rate travel). Drive the transition from a class
(`duration-300 ease-in-out`) so `motion-reduce:transition-none` can snap the
plate; do not set `transition` inline.

All horizontal `TabsList` variants (line / segmented / default) scroll inside their plate
via `ScrollFadeEdges` — native touch pan, mouse drag-to-pan on the compositor
(`translate3d` on the row, `scrollLeft` committed on settle; 60/120fps), no scrollbar; left/right fades
only when content overflows. The scroller is `overflow-x-auto overflow-y-clip` (not
`overflow-y-hidden`, which blocks touch pan on iOS). Triggers use `touch-pan-x` so a swipe
on the label pans the strip rather than eating the gesture. The strip must not expand its
ancestors: `min-w-0` on `Tabs`, `TabsLineBar`, and `CardHeader`. When every tab fits,
scrolling is inert and fades stay off. Pass `fadeClassName` to match the strip’s
surface (`from-card`, `from-popover`, …). Segmented `size="sm"` is 28px pills
(`h-7`, 11px type) for chrome such as the public demo viewing bar. The viewing
switcher (Free / Core / Edge) uses `data-plate` so the sliding plate is ink,
brand, or `--edge` violet.

**Select vs hold (app-wide).** Tabs activate on a clean click only. Click-and-hold (≥200ms)
or drag-to-pan must not change the active tab — hold is scroll intent. Keyboard: line tabs
accept Tab / Shift+Tab along the row (then Tab leaves into the page). Arrows, Enter and
Space still work. Segmented filters stay one Tab stop; use arrows there.

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
  plate stays violet (`--edge` / `--edge-foreground`). Pass `tone="profit"` for Casino
  filters so the active plate is `--profit` with `--profit-foreground` type.
  Prefer line tabs for page-level section switching.
- **`toolbarSelectTrigger`** - quiet rounded-full select / combobox beside
  FilterPills (Offers category). Transparent rest, muted type; open or applied
  value uses `bg-muted/60`. Not a raised `fieldControl` dropdown.
- **`toolbarSelectTriggerGhost`** - quiet ghost combobox (hover, open, and
  an applied value stay transparent). Height matches FilterPills (`h-8` at
  every breakpoint, no mobile `h-10` bump). Fixture competition / course
  filter uses `face="outline"` and `labelMode` `icon` on the feed bar.
  The menu list is `min(32rem, 70dvh)` tall.
- **Fixture pin** - stroke `Pin` on competition / course headers and in
  the filter menu, via `favouriteStarIcon(filled)`. Header pin is icon-wide
  and sits with the flag and title (`gap-3` / 12px before the flag). Football
  kick-off / FT / live minutes sit in the Hide column, right-aligned with
  the eye. Pinned uses
  `fill-brand text-brand`. Chrome says **Pinned** (rail: All, Pinned
  only). Persist keys stay `favouriteFootballScopes` / `favouriteRacingCourses`.
  Hide a competition with the eye in the clock column on the header, or
  after the name in All competitions.
  Pinned competitions do not show hide. Restore from the Hidden group in that
  menu (`hiddenFootballScopes` / `hiddenRacingCourses`). Hidden rows stay out
  of All / Scheduled / Live. Pinned and an explicit competition pick still show
  them.
- **Page CTAs** - `pagePrimaryButtonProps` (`variant="pagePrimary"`, `size="default"` / h-8,
  bold) next to outline siblings via `pageSecondaryButtonProps` at the same height.
- **`listPillState(active)`** - time/selection pills on racecards
- **History 2UP mark** (`historyTwoUpBadgeState` / `<HistoryTwoUpBadge>`) - compact
  brand pill (`Zap` + `2UP`) on the Goal! row that first puts a side two ahead.
  Solid `--brand` plate when that side was backed on the desk. Watching mark
  uses `bg-brand/10` + `ring-brand/40` with `text-primary-text` (ink in light,
  `--brand-text` in dark) when the fixture is only tracked, or the back is on
  the other side. Name it with `role="img"`. Do not also render a standalone
  `two_up` feed row for that trigger.
- **2UP fit ticks** (`TWOUP_TICK_TONE` / `TWOUP_TICK_TONE_EDGE` / `TWOUP_TICK_SIZE`) -
  five-step mark on Fixtures (`list`) and the match 2UP tab (`list`). Traffic-light
  colour unless the side is an Edge take (`TWOUP_TICK_TONE_EDGE`). On the fixture
  tape, **Edge** sits after the ticks. Upcoming tape lines reserve that
  list slot before scout returns, so ticks do not change row height. The tab is ticks only. `TWOUP_TICK_SIZE.modal` is the larger geometry if ticks
  return inside the match dialog.
- **Tape Goal flash** (`tapeGoalTag` / `useTapeGoalFlash`) - when a live
  list score ticks up, that side shows **Goal** 8px after the name (`gap-2`,
  same box as Edge / Backed, `px-1`). The scored cell and the Goal mark
  use `--tape-goal` / `--tape-goal-fg` (fixed `#f5c400` / `#111111`, never
  `--brand`) for `TAPE_GOAL_FLASH_MS` (20s). Live cells paint their own
  red; the shell is transparent so Goal cannot leak live red at the radius.
  NumberFlow `trend={1}` at 750ms rolls the new score. The tag blinks twice
  at 1.44s then holds. Only the last goal is marked: both sides never show
  Goal at once. A poll that jumped both scores uses the last standing event
  on the tape; if the tape has not caught up, wait rather than flash both.
  First paint can flash that last goal when it is on the current elapsed
  minute. Score corrections do not flash.
  Reduced motion keeps the plate and tag, no blink.
  Localhost only: `/fixtures?previewGoal=1` bumps the first two live homes
  and leaves the score. Goal holds 20s then clears. It does not write the
  store.
- **Exchange back tags** (`ExchangeBackTags`) - live match-odds backs on Home →
  Live → Events. Fixtures tape upcoming scores use `ExchangeBackStack` (home /
  away only, no Draw, no name labels). Betfair back plate (`exchanges.ts` `backColor`) via the shared
  `oddsCellStyle` / `oddsCellClass` recipe in `lib/ui/odds-cell.ts` (same as
  Racing Desk odds cells: light hex as-is, dark via `muteForDark`, same mix as
  calc Back/Lay plates). Radius is `rounded-sm` (2px tighter than `rounded-md`).
  Each badge uses `.surface-glass` for the shared inset rim. No tooltip.
  Hide the row when prices are missing; do not fall
  back to MODEL percentages. The open selection uses a heavier label only.
  Secondary names on the tinted plate use `text-black/60 dark:text-white/70`,
  matching calc Back/Lay copy. A price tick uses `NumFlow` (same Add bet
  counter). For 3s the digits flash profit or negative four times. A
  `size-3` `ChevronUp` (`text-profit`) or `ChevronDown` (`text-negative`)
  sits to the right of the price after a move. For the same 3s as the digit
  flash, green nudges up then down and red down then up. The next live quote
  with an unchanged back hides the chevron. Hold, empty, or suspend polls
  do not count as a quote, so the last icon stays.
  When Betfair parks the book, replace the back tags with `Market suspended`
  in `text-xs text-muted-foreground`, in a slot the same height as the odds
  row (`min-h-6`) so the card does not jump; do not flash until the market
  reopens. The last prices stay in the layout as `invisible` so the slot
  keeps their width and wrap height.
- **`listRow`** - hairline stack on a card or plate (`border-b`). The row
  itself is not a control, so there is no hover wash. Pressable stacks use
  `listRowInteractive`. Wrap sibling rows in `listRowGroup` so the last
  hairline drops (`[&>:last-child]:border-b-0`). When the class sits on a
  nested child (welcome Get to know), drop the last border on the parent
  instead. Bleed to the plate with `cardBleedX` + `cardInsetX` on each row.
- **`listRowInteractive`** - rounded pressable block (no hairline). Use for
  standalone taps (quick log, intelligence rows), not a stacked list.
- **`listRowSelected(active)`** - grey selection for sidebar lists
- **`sectionBar` / `sectionMeta`** - panel section headers
- **Day-split lists** (`ListDaySection`) - Campaigns, Casino Campaigns, Tracked
  Events, Profit Tracker, and History. Fixtures is one picked day, not a
  day-split list inside each competition. Label
  (`Today` / `Yesterday` / `Monday 6th July`) plus a hairline, then that day's
  cards, table, or fixture rows. Tokens: `listDaySectionLabel` /
  `listDaySectionContent`. History cards use `listDaySectionContentCompact`
  (`gap-3`; collapsed `gap-2`). Inside a competition/course plate with hairline
  rows, use `listDaySectionContentNested` (`mt-1.5 gap-0`) instead of the
  campaign-card stack. Light-mode fixture accordions are one `--card`
  plate: header and rows share the lift, split by a hairline. Dark
  keeps the wash on the header. Labels from `formatOfferListGroupLabel` (or the
  display-timezone wrapper `formatFixtureListDayLabel`). Page lists keep this
  header. Profit Tracker lists newest calendar day first (future, Today,
  Yesterday). Days after today pass `upcoming` on `ListDaySection`: a muted
  `Clock` before the label. In-feed stamps (Add bet Events, Home Live feed)
  use `ListDayRule` instead: a centred day pill on a hairline (`—— Today ——`).
  Home Live feed passes `sticky`: the stamp sits flush at the scrollport
  top (`z-20`, `--page` plate on desktop, `--background` / `--canvas` below
  `sm` to match the mobile Home deck, `py-2`) so Today does not nudge on first
  scroll. The Live feed title keeps its `border-b`; day stamps do not
  add a second rule above Yesterday. Rows and crest lock-ups stay
  `z-0` / `isolate` so logos scroll behind the plate. The stamp hangs
  the same downward wash as `ScrollFadeEdges` (`:after`) only while it
  is stuck, not in flow.
  Turn the list `startFade` off when that sticky stamp already occludes
  the leading edge. Add bet Events keeps the in-flow stamp. Do not
  invent a third day-header treatment.
- **`tableHeaderCell` / `tableBodyCell`** - compact table density
- **`deskTableWell` / `deskTableHeaderRow` / `deskTableHeaderRowSticky` /
  `deskTableBodyCell` / `tableEdgeStart` / `tableEdgeEnd` / `deskInsetX`**
  - Racing Desk results, day P&L, and the football match-events tape. The
  well sinks one step (`--canvas` / dark `--page`) inside a lifted card or
  dialog. Period / column headers use the selection-subtle band, not a
  full-bleed muted slab. Sticky period bars use `deskTableHeaderRowSticky`
  (`z-20`, solid `--selection-subtle`) and `deskTableWellCornerStart` /
  `deskTableWellCornerEnd` so the well can stay unclipped. Cell copy
  starts at 16px (`pl-4`) and ends at 24px (`pr-6`) so right-aligned
  clocks and scores do not kiss the rim.   The football match-events dialog
  is a fixed 4:5 plate on `sm+` (`h-[min(40rem,85dvh)]` at `max-w-lg`), not
  a 9:16 phone frame and not a hug-to-content height. Mobile stays a
  bottom sheet capped at `92dvh`.   Scoreboard and line tabs
  share one `--card` header plate (24px inset, no close control). A live
  score is a larger horizontal TV board: live red / FT muted, same
  tokens as the fixture list. Team names and the score sit on one
  grid row. Score cells add a little bottom padding so heading
  figures sit optically centred (list cells use the same 1px lift).
  A Goal inverts the scoring cell to
  `--tape-goal` for 20s and rolls the digit. No Goal tag on the names.
  Tape and
  XI copy use the same 24px inset, with 24px under the last row. The tape
  stays on `--page`. Commentary and Lineup scroll with
  `app-scroll-float` (native bar hidden) plus `ScrollFadeEdges
  overlayScrollbar`: a floating thumb on the tape, no track, no
  gutter (`z-30`, above sticky period bars). Rows stay full well width.
  Line tabs under the scoreboard split **Commentary** and **Lineup**.
  Upcoming or live matches with no tape yet use “No commentary yet”, not
  a finished-match miss. Starting XI (and bench when stored) live on
  Lineup. Modal loading / empty / error sit `bare` on `--page` (no
  plate, ring, or radius), centred in the tape well.
- **`deskTrackerSummaryBand`** - Profit Tracker Acca / Bet Builder / Systems
  strip above a bet ledger (`bg-selection-subtle` / dark `bg-input/50`) so the
  workflow block reads against the untinted table
- **`coreNavTag`** / **`edgeNavTag`** / **`PlanNavMark`** — side-nav plan locks.
  Locked N0 **parent** rows stay visible with a lock icon plus Core (brand plate)
  or Edge (`--edge` plate). Do not repeat the mark on Calendar / Campaigns /
  Combo Desk children. Do not put a section-level Pro tag on Combo Desk or Edge
  Report; those are Core. Offer Edge chrome (Race picks count) stays Edge-only.
  In-page lock titles use `Available on {plan} subscription`.
- **`backedNavTag`** — outline + quiet fill (`bg-foreground/10`,
  `ring-foreground/40`, ink type), same box as `edgeNavTag`. Same
  subdued language as the Home live-feed 2UP watch mark. Racing Desk
  runners and Fixtures football teams when that selection has a desk
  back. Check + BACKED, plus ` · N` when more than one bet.
- **`demoDataTag`** — solid `--warning` plate + white type. Header Demo data
  mark (`sm+` only, see AppTopBarHeader) and Race picks (dialog, confidence
  chip, trigger) share this so invented numbers cannot look live.
  **`adminModeTag`** is the same box; `/admin` uses the label ADMIN so the
  operator space cannot look like a customer desk. **`adminOwnerTag`** uses the
  Edge plate (`edgeNavTag`) and the label OWNER so the master account is
  distinct from operator admin. **`adminTestTag`** is a
  muted plate for accounts excluded from admin stats.
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
circular icon well, solid card plate (same ring / glassy face as other
Cards; do not add `border-dashed`), semibold title, muted description,
optional CTA. In-feed empties use `bare` (no plate). Do not ship centred
muted text on its own. Plated empties keep `data-slot="card"` so the
glassy face applies; mark them with `data-empty-state` rather than
overwriting the card slot. Page-level titles are `h2`; compact / nested /
dialog titles are `h3`. Dashed rims stay on drop-zones, not empties.

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
- **Modal** - `compact` so the plate fits the dialog, except Browse
  fixtures: the lock and board empties are full-width page empties so they
  match the fixture list measure. Keep the plate
  (do not flatten with `shadow-none` unless the empty sits inside another
  lifted card). 16px (`pb-4`) under the Football / Racing line bar, then
  the feed bar and pinned rail stay pinned; only the list scrolls.
- **In-feed** - `bare` (History feed and any similar live feed). Icon well
  and copy sit on the page background: no plate or radius.
  Page-level History (`/history`) still uses the plate.
- **Club crest lock-up** - `TeamCrestLockup` on Home Live feed and History
  match-moment and football Bet placed rows (right-hand side). Home top-left, away bottom-right,
  overlapping circles (`ring-1`) with a plate-matched cut-out: `ring-page`
  on Home live rows, `ring-card` on History cards.   Compact Home live rows
  use 12px left (`pl-3`), 14px right (`pr-3.5`), 8px top (`pt-2`) and 10px
  bottom (`pb-2.5`). Today / Yesterday (and older
  days) sit on a `ListDayRule` pill (same stamp chrome as Add bet Events;
  older-day copy stays `formatOfferListGroupLabel`, not Add bet’s short
  `Mon 6 Jul`). The row clock is
  time or match minute only. Title/subline share a 2px (`gap-0.5`) line gap.
  Icon and clock sit at the top of the row (`items-start`) so a live minute
  (`88'`) lines up with the fixture title, not the mid-point of two lines.
  Expanded History cards stay at 16px (`px-4`), collapsed History headers at
  12px (`px-3`). History `/history` uses `ListDaySection` (same Today /
  Yesterday hairline as Tracked Events), not the in-feed pill. Card clocks
  are time or match minute only (`omitDay`), same as the Home feed.
  Live feed and collapsed
  History use the `feed` well (`size-7`, inner discs `size-5` / 20px);
  expanded History uses `history` (`size-10`, inner discs `size-7` / 28px).
  One logo centres in the well; both missing stays empty (reserve the well
  while logos load so the rail does not jump). No invented fallback. Sit
  the pair inside the existing match control, not a second hidden button.
  The same lock-up is the PWA large-icon override (`/api/crest-lockup`);
  badge stays the bolt.
- **Nested in a card** - `compact`. Flatten with `className="shadow-none"`
  only for small nested hints (Home live dock, calendars, tracker lists).
  When the empty is the card’s main content (fixture board), keep the plate
  lift and the page-tinted well so it reads against the parent card.
- **Board column** - a kanban cell may use a short muted caption (“Nothing
  here”) instead of a second `EmptyState` plate. The board’s own empty (no
  items / filter miss) still uses `EmptyState`.
- **First-run empty Home** - after bank/bookies exist, `EmptyDeskWelcome` is a
  getting-started hub (several next actions), not a single content gap. Title
  and welcome line sit on the page; a hairline then Get started (2×2 tiles:
  Log / Add on the first row, Imports on the second, `size-6` leading marks)
  sit under that, then a Quick links row of `size="lg"` outline buttons. “Get to
  know the desk” is a `Card` page area (same shell as Profit
  Tracker) with `listRow` items on the card face. `pb-16` above the footer is
  deliberate air after the list. The card footer holds the full-width
  “⚡ edgeways is made…” note and Feedback form link.
  Render it in a growing `PageShell` (not `fullHeight`) so the app shell scrolls
  like History.
  Do not wrap it in `<EmptyState>`. Setup-missing Home still uses `<EmptyState>`.
- **Calculator index cards** - `/calculators` hub cards use the same leading
  mark as welcome Get started tiles: Lucide or a stroke-matched custom mark
  (`size-6 text-primary-text`, stroke 1.5, `size={24}`), stacked above the
  title. One distinct glyph per calculator. Early-payout Desk is a live desk
  at `/early-payout` and uses `Timer` in nav and the desk header. Title hairline and
  `--layout-stack-gap` match Racing Desk. Summary tiles stay five across;
  the pin rail is as wide as the right-hand tile. Football 2UP is one
  form on that desk. Racing Desk uses `HorseRacingIcon` (Lucide Lab
  horse-head) in nav, empties and welcome, not Trophy. Sport marks live
  in `sport-icon.tsx`.
- **First load (page)** - while we do not yet know whether Neon (or the
  page API) has line items, use `<PageLoading>` (`src/components/page-loading.tsx`):
  a centred `Loader2` on `PageShell fullHeight`, with a short visible line
  (the label, or a description when one is passed). Gated Core/Edge routes
  use the same spinner from `PlanRouteGate` until `/api/state` lands. Do
  not flash £0.00, “No bets logged yet”, or any other empty copy. Home,
  Profit Tracker, Offers, History, and the other list desks use this until
  the first payload lands.
- **Summary then list (Profit Tracker)** - once headline figures are on
  `/api/state`, paint the Summary strip immediately. Keep `<PlateLoading>`
  on the Bet log plate until the rows (and desk-run enrichment) are ready.
- **Loading the same plate** - chrome is already visible, the list is not.
  Use `<PlateLoading>` (thin wrapper on `<EmptyState busy compact>`):
  spinning icon well, “Loading …” title, and a line that the list will
  appear here. Do not show the empty copy, or mention Refresh, while the
  request is in flight. Reach for `<EmptyState busy>` directly when the
  plate needs a feature icon after load (Fixtures).
- **Not this pattern** - dropdown “no matches”, drop-zones, inline row
  hints (“No wallet”), command palette empty.
- **Plan lock** - a gated Core/Edge *page* uses the same `<EmptyState>` via
  `<PlanLockEmpty>` (`src/components/plan-lock-empty.tsx`): lock well for
  Core, zap for Edge. Title is `Available on {plan} subscription`. Primary is
  **View plans** with `pagePrimary` (brand), the same as other empties.
  Do not use `variant="edge"` on that page plate. Do not toast and block
  navigation to a page. Keep
  `toastPlanLock` for gated clicks that are not a page or a modal.
  In-page Edge features on a desk that still works (Racing live cards,
  2UP alerts) use `edgeLockBanner`: full-width `--edge/20` rectangle,
  solid `--edge` bolt well + Zap, **View plans** `variant="edge"`. Not
  an `<EmptyState>` plate. `promo="racing"` / `promo="twoUp"`. Race picks
  inside the courses card stays the page empty. Fixtures → Racing (page
  and Browse fixtures modal) uses the same full-width page empty when live
  racecards are locked, not “No live or upcoming races”. Settings 2UP row stays
  `edgePanel` + `pagePrimary` View plans.

Copy: British English, sentence case, commas. Title names the gap; description
invites the next action.

## Keyboard shortcuts sheet

`?` (when not typing) opens `DeskShortcutSheet`, not Help. Keycaps are
`Kbd` / `ShortcutKeys` in `src/components/ui/kbd.tsx`: muted plate, border,
`text-xs`. Sequences use “then” between keys (`g` then `h`). Chord pairs
(`⌘` `K`) sit adjacent. Mac shows `⌘`, Windows/Linux `Ctrl`. Modifier
chords stay `invisible` until the platform is known, so Windows does not
flash `⌘`. Bare keys and sequences can paint immediately. Filter empty
is a line of copy, not `<EmptyState>`. Nested
list scroll uses `ScrollFadeEdges` plus `app-scroll-nested` so clipped
rows fade instead of hard-cutting, and a classic gutter does not sit on
the keycaps. The keyboard Help guide renders the same `ShortcutRowList`
keycaps. The full guide stays linked from the sheet.

**Dialog save.** Primary confirm uses `DialogSaveButton`
(`data-dialog-save`). The button paints a stable `⌘↵` (Mac) or `Ctrl ↵`
(Windows/Linux) chord, and only on keyboard/desktop pointers
(`shortcut-hint`: `(hover: hover) and (pointer: fine)`). Do not show
keycaps on phones or other coarse pointers. Wait until the platform is
known before painting, so Windows does not flash `⌘`. On the confirm
button the keycaps are compact `11px` so they sit in the primary label;
sheet and Help keycaps stay `text-xs`. `⌘Enter` / `Ctrl+Enter` saves
from a field or elsewhere. Do **not** bind `⌘S` or a bare letter:
browsers and extensions often steal `⌘S`, and a lone `S` fights typing.
Do not swap the keycap when a modifier is held. Esc still closes. Mark
every modal confirm this way.

## Lay fields (odds and stake)

Every lay-odds and lay-stake input uses the shared exchange increment helpers.
Do not hand-roll `step={0.01}` number inputs for these fields. The Acca / Bet
Builder log-lay row, Add bet, calculators, and Lock in all share this rule.

**Lay odds** — `src/lib/calc/exchange-odds-step.ts` via `exchangeOddsStepping`
on `NumField` / `PanelInput` (or `exchangeOddsStepHandlers` on a raw input).

- Tick ladder is the UK exchange table (Betfair / Betdaq / Matchbook / Smarkets):
  1.01–2.00 ×0.01, 2–3 ×0.02, 3–4 ×0.05, 4–6 ×0.10, 6–10 ×0.20, 10–20 ×0.50,
  20–30 ×1, 30–50 ×2, 50–100 ×5, 100–1000 ×10.
- Up / down arrows, the native chevron stepper, and the scroll wheel move
  one exchange tick. From a typed off-tick price they go to the next tick
  only (6.97 → 7.0 / 6.8). A native snap such as 5.00 → 5.01 must become 5.1.
- The wheel must be bound with `useNonPassiveWheel` (`src/hooks/use-non-passive-wheel.ts`).
  React `onWheel` is passive, so it cannot stop the native number-input
  increment. Chevron clicks go through `handleExchangeOddsInputEvent`.
  `NumField` / `PanelInput` already do this.
- Manual typing is kept as entered. Do not snap 6.97 to 7.0 on blur. Same
  behaviour as Add bet `PanelInput`.

**Lay stake** — `src/lib/calc/exchange-stake-step.ts` via `layStakeStepping`
on `NumField`, or `LayStakeBanner` (Add bet / calculators).

Add bet and calculators share one editable `LayStakeBanner` field: no slate
strip, no **Fill slip** until the Chrome extension is a customer launch.
Lay bodies are a 2-col grid: Lay odds | Lay stake, so the two fields share a
width and sit on the same row. Copy sits inside the field with 8px inset from
the right edge (`LayStakeBanner` default `trailing="copy"`). Part-lay stake rows use the same well with `trailing="steppers"` instead of Copy. The well is `--pi` / `--pi-dark` (selected exchange tint) with
a hairline (`black/15` / `dark:white/12`). Liability, when shown, sits under
the stake field (`text-xs`) so it does not break that row. The Lay plate uses
`pb-4` matching the side gutter; only a Back plate with an Early payout footer
keeps the extra bottom inset for the rounded join.

- UK exchanges accept pounds and pence. Increment is always £0.01.
- Idle display is always two decimal places (`31.56`, `32.00`), never `32`
  or `31.6`. Use `formatLayStake` / `commitLayStake`, not a raw number input.
- Arrow keys and the scroll wheel step one penny. Calculated equalising
  stakes stay on the penny grid (`roundPence` / `executableLayStake`).

Agent rule: `edgeways/.cursor/rules/lay-fields.mdc`.

## Layout

- **`PageShell`** - `max-w-7xl` content width
- **`CalculatorShell`** - centred narrow column for forms. Bottom inset is `pb-16` (64px) so a last action (Add to profit tracker) has that air to the page-panel edge. Other `PageShell` pages keep `--layout-page-x` on every side. That last action is `CalculatorAddBetButton` at `size="lg"` (`h-9`, `h-11` on small screens), not the default `h-8` page CTA.
- **`ProfitTable`** - Bookie | Exchange | Total outcome rows. Risk-free / refund-if lose rows unpack the Bookie cell into stake lost, refund cash equivalent (at the entered retention), then net. Labels sit left of a single right-aligned money column; a full-width hairline sits above net. Exchange and Total align with that net. Clip overflow (`overflow-hidden`) so NumberFlow ticks cannot flash a scrollbar. Do not hide retention in a footnote. When Add bet Early payout is on, a third row sits under the two matched outcomes: Bookie as if the back paid, Exchange as if the lay won (same windfall as the 2UP calculator). Label is `If 2UP, and lay wins` (or the sport’s lead rule), not “both win”. Chevron is `--edge` / `--edge-foreground`. No row wash. Qualifying loss stays the worse of the two ordinary rows.
- **`SectionHeader`** - in-card list panel titles (Racing Desk courses, history groups)
- **Home mobile deck headers** (`DashboardSectionHeader`) — `--home-deck-header-h` (`4rem`) below `sm`. Every swipe-card header uses this height so Do next (title + segmented sort tabs) and title-only cards share one bar. Title and header actions sit vertically centred. Token: `homeDeckSectionHeader` in `layout-spacing.ts`. The P&L chart is not its own mobile card; it sits on Summary, with window pills in the Summary header `action` slot (same as Feed / desktop Chart). Plot floor: `--home-deck-chart-min-h`. Desktop still has a separate chart panel. In Settings, Chart is visibility-only (no deck reorder); showing it requires Summary.

## Applying to new pages

```tsx
<PageShell className="gap-5">
  <PageHeader
    title="Page title"
    description="One short sentence"
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

`/login` and `/sign-up` (`(auth)/layout`) are pinned dark, same idea as marketing: ink plate, brand yellow CTA, Clerk card as one dark face. Do not follow the desk Light/Dark toggle. Clerk applies `appearance.variables` against `html`, which is desk-light by default. Do not point those variables at `var(--card)` or `--marketing-*` (undefined / light on `:root`). Use the marketing plate literals in `EDGEWAYS_CLERK_APPEARANCE` (`#FFC71E`, `#1a1a1a`, `#f5f5f0`) and Clerk’s `dark` theme after `shadcn`. Nested `.dark` still re-binds `--color-card` for anything that reads host Tailwind tokens (see `globals.css`).

## Marketing canvas

Waitlist / launch pages live on `.marketing-root` (`--marketing-brand` yellow, `--marketing-canvas` `#0c0c0c` page plate, `--marketing-ink` for type on yellow, `--marketing-band` / `--marketing-band-deep`, `--marketing-rule` for how-it-helps and legal `h2` hairlines). Doc pages (`/contact`, `/terms`, `/privacy`, `/refund`) and root `error` / `not-found` share `MarketingDocPage`, which applies `.marketing-root` so the tokens exist even when those routes sit outside `(marketing)/layout`. Recovery actions use the `actions` slot (filled yellow plate + ink type), not the prose `[&_a]` well. Auth (`/login`, `/sign-up`) uses the same canvas. The desk does not. They pin `--edge` / `--edge-foreground` to the **dark-theme** Offer Edge plate so tags read on ink and do not follow the user’s desk accent. Shared FAQ and How-it-helps copy lives in `src/lib/marketing/landing-faq.ts`: we supplement finders, we do not send bookie offers, and the public offer stays Free / Core / Edge. FAQ answers use the section rail, not a nested `max-w-3xl`. Below-fold blocks settle in once (`[data-reveal]`, same 10px rise as `.marketing-fade-up`). Hide only after `html.marketing-reveal-armed` (client, after hash and on-screen marks), so no-JS and `#section` landings stay visible. Re-bind on each marketing pathname: the layout stays mounted, and a client nav (Refunds logo → home) would otherwise leave new reveal nodes at opacity 0. Peer columns (how-it-helps, plan cards) stagger 70ms from `sm` up via `[data-reveal-stagger]`. Hash links use `html.marketing-smooth-scroll { scroll-behavior: smooth }` after first paint so a `#section` landing still jumps. `scroll-padding-top` 1.5rem only (no extra `scroll-mt`). Off under `prefers-reduced-motion`. Hero stays the load fade, not a scroll reveal. Footer stays still. Legal nav is Terms, Privacy, Contact, Refunds. Post-checkout success (`/subscribe/success`) is a still thermal slip on `--marketing-fg` (`.marketing-receipt`, serrated teeth cut to `--marketing-canvas`, dashed `Paid today` rule). Not a printer animation and not a replacement for hosted Stripe Checkout. Paint the slip from the plan immediately; hydrate Stripe ref and email after first paint. Signature is the paid-today line. Yellow CTA is the only accent: **Set up the desk** → `/setup` (waitlist: **Back to Edgeways**). Launch homepage **Try the desk** → `/demo` (read-only fixture, Core/Edge bar). Full-page `/setup` is desk canvas + `panelSurface`, no side nav. Trust copy: subscription confirmed, manage billing (also Settings → Subscription), prices in GBP. No fake lock badges. No “confirming” after Checkout has returned.

Product peeks use `.marketing-panel` + `.marketing-panel-shine` (border-only conic shine; off under `prefers-reduced-motion`). Plan cards share `.marketing-panel`. The featured **Edge** plan adds `.marketing-panel-plan`: rim mixed from `--edge` into the default white/10 (not a solid chroma frame), shine, and a purple trial button. **Choose Core** is the yellow fill CTA. Free stays outline (`hover:bg-white/5`). Card titles are the same species: `text-lg font-semibold` white type, no plates. “Recommended” is `text-xs` sentence case, `text-edge` violet, on the right of the Edge title row. Core gets “Popular” in the same spot, muted grey (`text-white/55`). Comparison ticks follow the column (`size-6`): Free white, Core `--marketing-brand`, Edge `--edge`. Crosses stay muted white so colour means included. Table headers are coloured type (Core yellow, Edge `--edge`), not tags. The monthly/yearly control is centred under the heading: a silver chip (“2 months free with yearly”), then the supplied doodle arrow in the gap pointing at **Bill yearly**, then flanking labels plus a recessed track with a **solid** silver thumb (`--marketing-silver` + `--marketing-silver-face`), `radiogroup` / `radio`. Monthly is the default. The chip is a shortcut onto yearly. Sentence case, not brand yellow or money green. Do not override `edgeNavTag` with brand colours. The logo Beta chip stays on the scaled lockup box (`text-xs` + `scale-[0.625]`).
