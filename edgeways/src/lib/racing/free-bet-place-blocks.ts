/**
 * Contiguous free-bet place blocks for Racing Desk result hatch + outside labels.
 *
 * Multiple offers on one race: union their qualifying places, then merge any
 * consecutive positions into one block (one hatch + one "Free bet" label).
 * Gaps stay as separate blocks, each with its own label.
 *
 * SP-favourite offers only hatch when the recorded result confirms the winner
 * was the SP favourite (and any min favourite SP floor is met). Unknown SP
 * data suppresses those hatches rather than inventing a false positive.
 */

export type FreeBetPlaceBlockInput = {
  qualifies: boolean;
  qualifyingPlaces?: number[] | null;
  triggerText?: string | null;
  offerTitle?: string | null;
  /** QuinnBet-style: places only pay when the winner was the SP favourite. */
  winnerMustBeSpFavourite?: boolean;
  /** Optional floor on the favourite's Starting Price (decimal). */
  minFavouriteSpOdds?: number | null;
};

export type FreeBetPlaceResultContext = {
  /** null = SP favourite unknown on this result. */
  winnerWasSpFavourite: boolean | null;
  /** Shortest SP among SP favourites, when known. */
  favouriteSpOdds: number | null;
};

export type FreeBetPlaceBlock = {
  /** Sorted contiguous finish positions in this block. */
  places: number[];
  /** Tooltip — offer trigger/title, or "Free bet" when several offers merge. */
  title: string;
};

function placeTitle(tag: FreeBetPlaceBlockInput): string {
  return tag.triggerText?.trim() || tag.offerTitle?.trim() || "Free bet";
}

function blockTitle(titles: string[]): string {
  const unique = [...new Set(titles.filter(Boolean))];
  if (unique.length === 1) return unique[0]!;
  return "Free bet";
}

/** Whether this offer's places should hatch on the given result. */
export function offerPlacesActiveOnResult(
  tag: Pick<
    FreeBetPlaceBlockInput,
    "winnerMustBeSpFavourite" | "minFavouriteSpOdds"
  >,
  result?: FreeBetPlaceResultContext | null
): boolean {
  if (!tag.winnerMustBeSpFavourite) return true;
  if (!result || result.winnerWasSpFavourite == null) return false;
  if (!result.winnerWasSpFavourite) return false;
  const minSp = tag.minFavouriteSpOdds;
  if (minSp != null && minSp > 1) {
    if (result.favouriteSpOdds == null || !(result.favouriteSpOdds > 1)) return false;
    if (result.favouriteSpOdds + 0.0001 < minSp) return false;
  }
  return true;
}

/**
 * Build hatch place set + contiguous label blocks from qualifying offer tags.
 */
export function buildFreeBetPlaceBlocks(
  tags: FreeBetPlaceBlockInput[],
  result?: FreeBetPlaceResultContext | null
): {
  allPlaces: Set<number>;
  blocks: FreeBetPlaceBlock[];
} {
  const titlesByPlace = new Map<number, string[]>();
  for (const tag of tags) {
    if (!tag.qualifies || !tag.qualifyingPlaces?.length) continue;
    if (!offerPlacesActiveOnResult(tag, result)) continue;
    const title = placeTitle(tag);
    for (const p of tag.qualifyingPlaces) {
      if (!Number.isInteger(p) || p < 2) continue;
      const list = titlesByPlace.get(p) ?? [];
      list.push(title);
      titlesByPlace.set(p, list);
    }
  }

  const sorted = [...titlesByPlace.keys()].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { allPlaces: new Set(), blocks: [] };
  }

  const blocks: FreeBetPlaceBlock[] = [];
  let run: number[] = [sorted[0]!];
  let runTitles = [...(titlesByPlace.get(sorted[0]!) ?? [])];

  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i]!;
    if (p === run[run.length - 1]! + 1) {
      run.push(p);
      runTitles.push(...(titlesByPlace.get(p) ?? []));
    } else {
      blocks.push({ places: run, title: blockTitle(runTitles) });
      run = [p];
      runTitles = [...(titlesByPlace.get(p) ?? [])];
    }
  }
  blocks.push({ places: run, title: blockTitle(runTitles) });

  return { allPlaces: new Set(sorted), blocks };
}
