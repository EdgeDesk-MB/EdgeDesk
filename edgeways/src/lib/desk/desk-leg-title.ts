/**
 * Desk leg titles: the bet selection (horse / team) is primary.
 * Race or fixture name is secondary context when useful.
 */

export type DeskTitleEvent = {
  sport?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
};

function isRacingSport(sport: string | null | undefined): boolean {
  return sport === "horse_racing" || sport === "greyhounds";
}

/** Human label for a stored selection code or free-text runner. */
export function selectionDisplayLabel(
  selection: string | null | undefined,
  event?: DeskTitleEvent | null
): string | null {
  const sel = selection?.trim();
  if (!sel) return null;
  if (sel === "home") return event?.homeTeam?.trim() || "Home";
  if (sel === "away") return event?.awayTeam?.trim() || "Away";
  if (sel === "draw") return "Draw";
  return sel;
}

/** True when `label` matches the event title we used to auto-fill (race / fixture). */
export function isEventAutoLabel(
  label: string,
  event?: DeskTitleEvent | null
): boolean {
  const t = label.trim();
  if (!t || !event) return false;
  const home = (event.homeTeam ?? "").trim();
  const away = (event.awayTeam ?? "").trim();
  if (isRacingSport(event.sport)) return Boolean(home) && t === home;
  if (home && away && t === `${home} v ${away}`) return true;
  return Boolean(home) && t === home;
}

export function deskLegTitleParts(
  leg: {
    label: string;
    selection?: string | null;
    sport?: string | null;
  },
  event?: DeskTitleEvent | null
): { primary: string; secondary: string | null } {
  const fromSel = selectionDisplayLabel(leg.selection, event);
  const label = leg.label.trim();
  const sport = leg.sport ?? event?.sport ?? null;

  if (fromSel) {
    let secondary: string | null = null;
    if (isRacingSport(sport)) {
      const race = (event?.homeTeam ?? "").trim();
      if (race && race !== fromSel) secondary = race;
      else if (label && label !== fromSel) secondary = label;
    } else if (event) {
      const home = (event.homeTeam ?? "").trim();
      const away = (event.awayTeam ?? "").trim();
      const fixture = home && away ? `${home} v ${away}` : home;
      if (fixture && fixture !== fromSel) secondary = fixture;
    }
    return { primary: fromSel, secondary };
  }

  return { primary: label || "Leg", secondary: null };
}

/**
 * When the selection changes, refresh the editable label unless the user
 * typed a custom one (not empty, not event auto-fill, not the previous selection).
 */
export function nextDeskLegLabel(opts: {
  currentLabel: string;
  previousSelection?: string | null;
  nextSelection: string;
  event?: DeskTitleEvent | null;
}): string {
  const display = selectionDisplayLabel(opts.nextSelection, opts.event);
  if (!display) return opts.currentLabel;
  const cur = opts.currentLabel.trim();
  if (!cur) return display;
  if (isEventAutoLabel(cur, opts.event)) return display;
  const prev = selectionDisplayLabel(opts.previousSelection, opts.event);
  if (prev && cur === prev) return display;
  // Racing: prior bug filled race name into label before a horse was chosen.
  if (
    isRacingSport(opts.event?.sport) &&
    (opts.event?.homeTeam ?? "").trim() === cur
  ) {
    return display;
  }
  return opts.currentLabel;
}
