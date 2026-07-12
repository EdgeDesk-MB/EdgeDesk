/**
 * Rename a bookie/exchange account and cascade the display name everywhere it appears.
 */
import { eq } from "drizzle-orm";
import { db, accounts, bets, exchanges, offers, type AccountRow } from "@/lib/db";
import { getAppSettings, patchAppSettings } from "@/lib/services/settings";

export interface RenameVenueResult {
  account: AccountRow;
  betsUpdated: number;
  offersUpdated: number;
  prefsUpdated: number;
}

export function renameVenueAccount(
  accountId: number,
  newNameRaw: string
): RenameVenueResult {
  const trimmed = newNameRaw.trim();
  if (!trimmed) throw new Error("Name is required");

  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) throw new Error("Account not found");

  const oldName = account.name;
  if (oldName.toLowerCase() === trimmed.toLowerCase() && oldName === trimmed) {
    return { account, betsUpdated: 0, offersUpdated: 0, prefsUpdated: 0 };
  }

  const clash = db
    .select()
    .from(accounts)
    .all()
    .find(
      (a) =>
        a.id !== accountId &&
        a.type === account.type &&
        a.name.toLowerCase() === trimmed.toLowerCase() &&
        a.isActive
    );
  if (clash) throw new Error("An account with this name already exists");

  const updated = db
    .update(accounts)
    .set({ name: trimmed })
    .where(eq(accounts.id, accountId))
    .returning()
    .get();

  let betsUpdated = 0;
  let offersUpdated = 0;
  let prefsUpdated = 0;

  if (account.type === "bookie") {
    const oldKey = oldName.toLowerCase();
    for (const bet of db.select().from(bets).all()) {
      if (bet.bookmaker?.trim().toLowerCase() === oldKey) {
        db.update(bets).set({ bookmaker: trimmed }).where(eq(bets.id, bet.id)).run();
        betsUpdated += 1;
      }
    }
    for (const offer of db.select().from(offers).all()) {
      if (offer.bookmaker?.trim().toLowerCase() === oldKey) {
        db.update(offers).set({ bookmaker: trimmed }).where(eq(offers.id, offer.id)).run();
        offersUpdated += 1;
      }
    }

    const settings = getAppSettings();
    let nextDefault = settings.defaultBookmaker;
    let changed = false;
    if (settings.defaultBookmaker.trim().toLowerCase() === oldKey) {
      nextDefault = trimmed;
      changed = true;
      prefsUpdated += 1;
    }
    const prefs = { ...settings.offerBetPrefs };
    for (const [id, pref] of Object.entries(prefs)) {
      if (pref.bookmaker.trim().toLowerCase() === oldKey) {
        prefs[id] = { ...pref, bookmaker: trimmed };
        changed = true;
        prefsUpdated += 1;
      }
    }
    if (changed) {
      patchAppSettings({
        defaultBookmaker: nextDefault,
        offerBetPrefs: prefs,
      });
    }
  }

  if (account.type === "exchange" && account.exchangeId) {
    db.update(exchanges)
      .set({ name: trimmed })
      .where(eq(exchanges.id, account.exchangeId))
      .run();
  }

  return {
    account: updated,
    betsUpdated,
    offersUpdated,
    prefsUpdated,
  };
}
