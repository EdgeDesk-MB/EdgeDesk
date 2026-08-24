import { cn } from "@/lib/utils";

/** Untitled UI–style raised control (inset lip + soft drop) — outline / secondary */
export const skeuo = "skeuo";

/** Raised solid fill with top highlight bevel — primary / ink chips */
export const skeuoSolid = "skeuo-solid";

/**
 * Field plate — Input/textarea rest recessed (button pressed face);
 * SelectTrigger / VenueSelect rest raised and press on open.
 * Behaviour lives on `.field-control` in globals.css.
 */
export const fieldControl = cn(
  "skeuo-solid field-control rounded-[var(--radius-button)] border-transparent bg-[#eeeeee] dark:bg-input/30"
);

/** White card lifted above the grey-blue page surface */
export const surfaceLift = cn(
  "surface-lift bg-card text-card-foreground ring-1 ring-border/40 dark:ring-0"
);

/** Main centred page panel - grey-blue, sits on the canvas shell */
export const pagePanel = cn(
  "page-panel overflow-hidden bg-page text-foreground ring-1 ring-border/40 dark:ring-0"
);

/** Nested full-width panel on the page - white lifted block */
export const pageSurface = cn(
  surfaceLift,
  "overflow-hidden rounded-[var(--layout-page-radius)]"
);

/**
 * Nested content panel (calculators, forms) — glassy face, no boxy border.
 * Prefer over `rounded-xl border bg-card`.
 */
export const panelSurface = cn(
  "surface-glass relative overflow-hidden rounded-xl bg-card"
);

/**
 * Ranked ticket inside a dialog (Race picks). Same glassy `--card` plate as
 * {@link panelSurface}, tighter radius for a stacked list. Pair with a
 * page-toned dialog (`data-dialog-tone=page` + `dark:bg-page`) so the ticket
 * lifts. Prefer over `rounded-lg border bg-card` — that fill matches
 * `dark:bg-card` modals.
 */
export const dialogTicketSurface = cn(panelSurface, "rounded-lg");

/** Lighter grey - hover states, secondary bars, section headers on white */
export const selectionSubtle = "bg-selection-subtle";

/** Muted grey band - matches the "Campaign P&L" header strip on Acca run cards
 * and the Tracker's campaign grouping. Neutral alternative to a coloured panel
 * when there's no exchange/bookie to tint from. */
export const campaignHeaderBand = "bg-muted/50 dark:bg-input/30";

/**
 * Profit Tracker desk strip (Acca / Bet Builder / Systems) above a bet ledger.
 * Stronger than the old muted/20 wash so the workflow block reads as a plate
 * against the untinted table below — selection-subtle in light, lifted input
 * wash in dark.
 */
export const deskTrackerSummaryBand =
  "border-b border-border/60 bg-selection-subtle dark:bg-input/50";

/** Stronger grey - selected / active items */
export const selectionSubdued = "bg-selection-subdued";

/**
 * Empty-state plate. Follows the canvas → page → card stack:
 * on a page, lift to `--card` (lighter than `--page` in both themes);
 * nested in another card, sink to `--page` so the plate contrasts;
 * inside a default dialog (`bg-page` / dark `bg-card`), sink one step
 * (`--canvas` / dark `--page`) so the plate is darker than the modal.
 * Page-toned dialogs (`data-dialog-tone=page`, e.g. Race picks) already
 * sit on `--page` in dark, so the plate sinks to `--canvas`.
 */
export const emptyStatePlate = cn(
  "bg-card",
  "in-data-[slot=card]:bg-page",
  "in-data-[slot=dialog-content]:bg-canvas in-data-[slot=dialog-content]:dark:bg-page",
  "in-data-[slot=dialog-content]:in-data-[dialog-tone=page]:dark:bg-canvas"
);

/**
 * Circular icon well above empty-state titles.
 * On a page: `--muted` (darker than the card in light, lighter in dark).
 * In a modal: one step darker than the inset plate (`--input` / dark `--canvas`).
 * On a page-toned dialog empty (`--canvas` plate), lift the well with `--input`.
 */
export const emptyStateIconWell = cn(
  "flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground",
  "in-data-[slot=dialog-content]:bg-input in-data-[slot=dialog-content]:dark:bg-canvas",
  "in-data-[slot=dialog-content]:in-data-[dialog-tone=page]:dark:bg-input"
);

/** Page empty-state copy inset from plate edges: 32px mobile, 64px from sm up. */
export const emptyStateCopyInset = "px-8 sm:px-16";

export const pageTitle =
  "min-w-0 text-pretty break-words text-xl font-bold tracking-tight text-foreground";

/**
 * Modal header band — title, concise description, full-bleed hairline.
 * DialogHeader / DialogTitle / DialogDescription already apply these.
 * Use the tokens when a custom header must match (p-0 shells, toolbars).
 */
export const dialogHeaderBand =
  "flex min-w-0 flex-col gap-1.5 border-b px-6 pb-3.5 pt-6 pr-14 text-left";

export const dialogTitle =
  "min-w-0 break-words font-heading text-xl font-extrabold leading-tight tracking-tight text-foreground";

/** Prefer a short line; wrap when a name or sentence needs it. */
export const dialogDescription =
  "min-w-0 text-pretty break-words text-sm leading-snug text-muted-foreground";

/** Inline icon next to a 20px dialog title — matches the type size. */
export const dialogTitleIcon = "size-5 shrink-0";

/**
 * In-page section titles (P&L breakdown, By month, …).
 * Matches Racing Desk race titles: sentence case, text-base semibold.
 * For small uppercase chrome captions use {@link captionHeading}.
 */
export const sectionTitle =
  "min-w-0 text-pretty break-words text-base font-semibold leading-snug tracking-tight text-foreground";

export const sectionDescription =
  "min-w-0 text-pretty break-words text-xs text-muted-foreground";

/** Vertical gap between stacked page sections / breakdown blocks after a main item */
export const sectionStack = "flex flex-col gap-[var(--layout-stack-gap)]";

/** Small uppercase caption for nav sections and column headers outside tables */
export const captionHeading =
  "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

/** Campaigns-style day-split heading (`Today` / `Monday 6th July`). Not uppercase. */
export const listDaySectionLabel =
  "min-w-0 text-pretty break-words text-xs font-semibold tracking-wide text-foreground";

/** Stack under a day-split heading (campaign cards or a day's table). */
export const listDaySectionContent = "mt-3 flex flex-col gap-4.5";

/** Burger drawer utility row (meta links, Log out). `w-full` so buttons fill like links. */
export const drawerUtilityRow =
  "flex w-full items-center gap-3 px-4 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-muted/60";

export const tableHeaderCell =
  "h-8 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export const tableBodyCell = "px-2 py-2 align-middle";

/**
 * Outer horizontal inset for Racing Desk–style data tables (results, P&L).
 * Right matches left so right-aligned end columns do not sit flush to the edge.
 */
export const tableEdgeStart = "pl-4";
export const tableEdgeEnd = "pr-6";

/** Header band + type for desk-style tables (race results, day P&L). */
export const deskTableHeaderRow =
  "border-x-0 border-y border-border/60 bg-selection-subtle/50 text-xs uppercase tracking-wide text-muted-foreground";
/** Match Racing Desk results `<th>`: py-2 / px-2 (edges via tableEdge*). */
export const deskTableHeaderCell =
  "h-auto border-x-0 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
/** Match Racing Desk results `<td>`: py-2.5 / px-2. */
export const deskTableBodyCell = "px-2 py-2.5 align-middle";

export const listRow =
  "border-b border-border/60 transition-colors hover:bg-selection-subtle";

export const listRowInteractive = cn(
  "rounded-md border border-transparent transition-colors",
  "hover:bg-selection-subtle"
);

export function listRowSelected(active: boolean) {
  return cn(
    listRowInteractive,
    active &&
      "border-selection-subdued-border bg-selection-subdued text-foreground"
  );
}

export const listPill = cn(
  "shrink-0 rounded border px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors"
);

export function listPillState(active: boolean) {
  return cn(
    listPill,
    active
      ? "border-selection-subdued-border bg-selection-subdued text-foreground"
      : "border-transparent bg-card/80 text-muted-foreground hover:border-border hover:bg-selection-subtle hover:text-foreground"
  );
}

export {
  deskBandPad,
  deskBandPadFooter,
  deskCardShell,
  deskInsetX,
  sectionBar,
  sectionMeta,
} from "@/lib/ui/layout-spacing";

export const navLink = cn(
  "flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
  "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
);

export function navLinkState(active: boolean) {
  return cn(
    navLink,
    active
      ? "font-semibold text-primary-text"
      : "text-muted-foreground hover:text-foreground"
  );
}

/**
 * Brand secondary accent — ink plate (#111) + readable brand type (`--brand-text`).
 * Legacy primary chips. Raised (skeuo). Filter pills and segmented tabs use solid
 * `--brand` / `--brand-foreground` instead.
 * Weight stays semibold so active/inactive chips don’t jump in width.
 */
export const brandChipActive =
  "skeuo-solid skeuo-sm bg-[#111111] font-semibold text-brand-text";

/**
 * Counters / nav badges — flat.
 * Light: ink plate + off-white type.
 * Dark: same mute as unselected Racing Desk filter-pill counts
 * (`bg-foreground/10 text-foreground/70`).
 */
export const brandChipCount =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#111111] px-1.5 text-[11px] font-bold tabular-nums text-[#fafafa] dark:bg-foreground/10 dark:text-foreground/70";

/**
 * Shared box for Core / Edge / Backed marks. Floor 11px.
 * Logo / nav lockup chips stay on `text-xs` + `scale-[0.625]` (`proNavTag`).
 */
export const navTag =
  "inline-flex items-center rounded-[3px] px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none tracking-wide";

/**
 * Pro tier mark beside nav section labels — Offer Edge violet plate, same
 * scaled geometry as top-bar Beta (`text-xs` + `scale-[0.625]`).
 */
export const proNavTag =
  "inline-flex origin-left scale-[0.625] -mr-[37.5%] items-center rounded-[3px] bg-edge px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wide text-edge-foreground";

/**
 * Core tier mark — brand plate (same language as the demo viewing bar).
 */
export const coreNavTag = `${navTag} bg-primary text-primary-foreground`;

/**
 * Edge tier mark — Offer Edge violet plate. Contrast type via `--edge-foreground`.
 */
export const edgeNavTag = `${navTag} bg-edge text-edge-foreground`;

/**
 * Demo data mark — solid warning plate, same box as Core / Edge tags.
 * Header and Race picks share this so invented numbers cannot look live.
 */
export const demoDataTag = `${navTag} bg-warning text-white`;

/**
 * Operator /admin mark — same box as Demo data so the mode chip is unmistakable.
 */
export const adminModeTag = demoDataTag;

/**
 * Settled/open bet mark on Racing Desk runners — same box as `edgeNavTag`
 * (11px, px-1.5 py-0.5, rounded-[3px]); ink plate + canvas type.
 */
export const backedNavTag =
  "inline-flex items-center gap-1 rounded-[3px] bg-foreground px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none tracking-wide text-background";

/**
 * Brand-plate counter for sitting on ink / neutral chrome (not on active
 * filter pills — those are already brand/edge filled).
 */
export const brandChipCountOnInk =
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold tabular-nums text-brand-foreground";

/** Fixed-size counter shell used by filterPillCountState (active + inactive). */
export const filterPillCount =
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums";

/**
 * Counter chip for filter pills — same box either state so selection doesn’t jump.
 * Active sits on the brand or edge plate: ink plate + off-white type in both
 * themes (never brand-on-brand, brand-on-edge, or dark-mode brand-text).
 */
export function filterPillCountState(active: boolean) {
  return cn(
    filterPillCount,
    active
      ? "bg-[#111111] text-[#fafafa]"
      : "bg-foreground/10 text-foreground/70"
  );
}

/** @deprecated Prefer brandChipCount */
export const brandChipCountInverse = brandChipCount;

/** @deprecated Prefer brandChipActive — kept for any stray imports */
export const monoAccentActive = brandChipActive;

/**
 * Desk filter / tab pills (class recipe).
 * Prefer `<FilterPill>` for pressable page filters — it uses PressButton.
 * Keep this helper for compact Home chips and dense one-offs.
 * `hasCount`: 4px less right pad (`pr-2` vs `px-3`) so the chip sits tighter;
 * default pills use `min-h-8` so rows with/without counters share height.
 * `compact`: denser Home Chart / History feed chips (no 3D press).
 */
export function filterPillState(
  active: boolean,
  opts?: { hasCount?: boolean; compact?: boolean; tone?: "default" | "edge" }
) {
  const edgeActive = active && opts?.tone === "edge";
  return cn(
    "inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors",
    "outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-page",
    edgeActive
      ? "focus-visible:ring-edge/60"
      : "focus-visible:ring-brand/60",
    opts?.compact
      ? "min-h-0 px-2.5 py-[6px] text-[11px] leading-none"
      : cn(
          "min-h-8 py-1.5 text-xs",
          opts?.hasCount ? "pl-3 pr-2" : "px-3"
        ),
    active
      ? edgeActive
        ? cn(
            "skeuo-solid skeuo-sm bg-edge font-semibold text-edge-foreground",
            "hover:bg-edge hover:text-edge-foreground focus-visible:text-edge-foreground active:bg-edge active:text-edge-foreground"
          )
        : cn(
            "skeuo-solid skeuo-sm bg-brand font-semibold text-brand-foreground",
            "hover:bg-brand hover:text-brand-foreground focus-visible:text-brand-foreground active:bg-brand active:text-brand-foreground"
          )
      : "bg-muted/60 text-foreground/75 hover:bg-muted hover:text-foreground dark:bg-input/30 dark:hover:bg-input/50"
  );
}

/** Compact “Convert” CTA shared by Do next cards and Accounts free-bet rows. */
export const convertFreeBetButtonClass = "h-7 shrink-0 text-xs";

/** Layout wrapper for a row of filterPillState buttons (pills carry their own fill) */
export const filterPillGroup = cn(
  "inline-flex flex-wrap items-center gap-1.5"
);

/**
 * Campaign-style card chrome — outer ring (light) + glassy Shopify face via
 * `.offer-campaign-card::after` (same language as chips / ChromeTab; see globals).
 * No hover here — only interactive shells get brightness lift (see
 * `offerCampaignCardInteractive`).
 */
export const offerCampaignCardShell = cn(
  "offer-campaign-card group relative flex overflow-hidden rounded-lg bg-card text-left transition-colors",
  "ring-1 ring-border/50 dark:ring-0"
);

/** Whole-card open / navigate affordance — pair with a real click/keyboard handler. */
export const offerCampaignCardInteractive = cn(
  "cursor-pointer hover:brightness-[0.98] dark:hover:brightness-110"
);

/**
 * Home Do next carousel card width. Fixed so a single short card does not
 * shrink to its content inside the `w-max` snap row. Mobile stack stays `w-full`.
 */
export const doNextCarouselCardWidth = "w-[300px]";

/** Shared type scale for Offers / Casino / Acca / Bet builder / Systems cards.
 * Half-step above the previous recipe (not a full Tailwind notch). */
export const campaignCardTitle =
  "mt-3 text-[1.375rem] font-bold leading-snug text-foreground";
export const campaignCardPnl = "text-[1.375rem] font-bold tabular-nums";
export const campaignCardPnlLabel =
  "text-xs font-medium uppercase tracking-wide text-muted-foreground";
export const campaignCardNextAction = "mt-1.5 text-[13px] text-primary-text/90";
export const campaignCardDetailsLabel =
  "shrink-0 text-[13px] font-semibold tracking-wide text-foreground";
/** Collapsed Details preview: one line, as much as fits, then ellipsis. */
export const campaignCardDetailsSummary =
  "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-normal text-muted-foreground";
export const campaignCardDetailsToggle =
  "flex w-full min-h-9 min-w-0 items-center gap-2 px-(--card-spacing) py-2.5 text-left transition-colors hover:bg-foreground/5";
export const campaignCardFooterMeta = "text-[13px] text-muted-foreground";
export const campaignCardStakeLine =
  "mt-2.25 flex flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold tabular-nums tracking-tight text-foreground";
export const campaignCardBadge = "h-6.5 text-[13px]";
/** Header band: top inset from card token; bottom doubled vs former pb-3. */
export const campaignCardHeader = "space-y-0 pt-(--card-spacing) pb-6";
/** Gap before major header blocks (pipeline, probability bar, edge panel). Was mt-3 / mt-2 ×1.5. */
export const campaignCardHeaderBlock = "mt-4.5";
export const campaignCardHeaderBlockSm = "mt-3";
export const campaignCardOpenLink =
  "mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-primary-text hover:underline";

/** Calendar cards — same shell; left inset skips the priority bar column */
export const offerCalendarCardShell = cn(offerCampaignCardShell, "offer-calendar-card");

/**
 * Free-bet outline badge on campaign / Acca / Systems / Do next cards —
 * `--edge` in both themes (not ad-hoc `violet-*`).
 */
export const campaignFbBadge =
  "border-edge/40 bg-edge/10 text-edge";

/** Count pill for Offer Edge recommended races / offers (pro signature). Min 12px type/icons. */
export const edgeMarkerPill =
  "inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full bg-edge/15 px-1.5 text-[12px] font-bold tabular-nums leading-none text-edge";

/** Qualifying-offer count pill — same geometry as edgeMarkerPill. */
export const qualifyMarkerPill =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-success/15 px-1.5 text-[12px] font-bold tabular-nums leading-none text-success";

/**
 * White L→R wash (10% → 5%) with mix-blend overlay — lifts tinted outline
 * cards off the page in light and dark. Pair with a soft tone fill (edge /
 * success / warning). Children stack above the wash via `[&>*]:z-[1]`.
 */
export const tintCardWash = cn(
  "relative isolate overflow-hidden",
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
  "before:bg-gradient-to-r before:from-white/10 before:to-white/5 before:mix-blend-overlay before:content-['']",
  "[&>*]:relative [&>*]:z-[1]"
);

/**
 * Soft panel chrome for Edge recommendations on desk surfaces (Offer Workflow).
 * Do not nest washed `edgePanel` inside campaign cards — use a quiet
 * `border-edge/20 bg-edge/5` inset there (see OfferEdgePanel).
 */
export const edgePanel = cn(
  "rounded-md border border-edge/25 bg-edge/5",
  tintCardWash
);

/** Neutral inset note (setup copy, Core upgrade nudge). Not a warning. */
export const quietPanel = "rounded-md border border-border/60 bg-muted/30";

/** Qualifying / success tinted outline card (offer workflow, qualifies chrome). */
export const qualifyPanel = cn(
  "rounded-md border border-success/25 bg-success/5",
  tintCardWash
);

/** Warning tinted outline card — same wash recipe as Edge / Qualifying. */
export const warningPanel = cn(
  "rounded-md border border-warning/25 bg-warning/5",
  tintCardWash
);

/** Blocked / failed tinted outline card — same wash recipe as Qualifying. */
export const destructivePanel = cn(
  "rounded-md border border-destructive/25 bg-destructive/5",
  tintCardWash
);

/**
 * In-page execution warning plate (offer requirements, exchange funding).
 * Stronger than {@link warningPanel}. Use via `<WarningNotice>`.
 */
export const warningNotice = cn(
  "rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground"
);

/**
 * In-page success note (onboarding upgrade confirmation).
 * Stronger and cleaner than {@link qualifyPanel}: no mix-blend wash.
 */
export const successNotice = cn(
  "rounded-md border border-success/40 bg-success/10"
);

export const edgePanelStrong = cn(
  "rounded-md border border-edge/45 bg-edge/10 ring-1 ring-edge/30",
  tintCardWash
);