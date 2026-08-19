# Platform profit import (Oddsmonkey, then Outplayed)

> Dedicated CSV importers so users of finder platforms can bring their
> profit history into Edgeways and keep tracking here. Generic spreadsheet
> import (E3) stays as the fallback.
>
> Fixture (2 rows, 16 Aug 2026):
> `docs/strategy/fixtures/oddsmonkey-profits-sample.csv`
> Files: `profits-16-08-2026-08-33-74.csv` (manual),
> `profits-16-08-2026-09-17-06.csv` (manual + Oddsmatcher football).
>
> Linear: [EDGE-68](https://linear.app/samhayter/issue/EDGE-68).
> Empty Home: [EDGE-63](https://linear.app/samhayter/issue/EDGE-63).
>
> **Locked 16 Aug 2026:** sport list, bet-type list, exchange list, bet-source
> list, manual-entry fields, and the CSV flatten (no back/lay).
>
> **Waiting on Sam (do not block the rest of first-run):** a fuller Oddsmonkey
> profits CSV once the tracker has one row per record type (see §11). That
> file finishes CSV *exactness*. Parser core can ship against the two-row
> fixture. Outplayed waits on its own CSV.

Last updated: **16 Aug 2026** (manual-entry + Oddsmatcher football pass).

---

## 1. Why this is a launch feature

People leaving Oddsmonkey (or Outplayed) will not retype years of P&L. The
#1 empty-desk action for that audience is **Import from Oddsmonkey**, with
their logo, then the same pattern for Outplayed.

We supplement those platforms: they found the offers, we become the system
of record going forward.

---

## 2. What the export actually is

A **flattened profit-tracker ledger**, not a matched-bet ticket and not
the full Oddsmatcher card.

One CSV row = one tracker entry = one net P&L figure. The football
Oddsmatcher card shows Back (partypoker £10 @ 1.21) and Lay (Smarkets
£10 @ 1.21, liability £2.10). The CSV for that card is a **single** row:
bookie = partypoker only, profit £0, no stakes, no odds, no exchange.

**Do not try to rebuild live Edgeways bets, acca runs, or 2UP positions
from this file.** Import is historical P&L plus labels, so the desk is
no longer empty and monthly charts have a past. New work is logged in
Edgeways as usual.

Existing E3 import already writes `source: "import"` history (no wallet
moves, no EV capture). Platform import reuses that contract.

Do **not** import `overallRunningTotal` or `monthlyRunningTotal`.
Edgeways recomputes running P&L.

---

## 3. Manual entry (UI) vs CSV

Oddsmonkey “New Manual Entry” fields, and what the profits CSV actually
contains.

| UI field | CSV column | Notes |
|----------|------------|--------|
| Date / Time (24h) | `date` | When they logged it. Football example: `16-08-2026 09:10:00` |
| (event kickoff) | `eventTime` | When the fixture is. Football: `20-08-2026 19:00:00` (UI showed 20:00 UK; CSV looks like UTC, BST +1) |
| Event | `event` | Free text. Manual placeholder was `Event`. Oddsmatcher filled `Benfica v AGF Aarhus` |
| Bet | `outcome` | Free text **selection**, not a row-kind enum. Manual defaulted to `Bet`. Football = `Benfica` |
| Bet type | `betType` | Dropdown. See §5 |
| Bookmaker | `bookmaker` | Back bookie only. `10bet`, `partypoker`. Exchange is **not** exported |
| Exchange | **missing** | Dropdown exists on the form. CSV has no column. Cannot import the lay venue |
| Sport | `sport` | See §6 |
| Notes | `details` | Football row stored `Note`. May truncate; treat as notes |
| Expected profit | `expectedProfit` | Aligns with our `bets.expectedProfit` (EV). Still excluded from Edge Report capture on import |
| Actual profit | `actualProfit` and `profit` | Prefer `actualProfit`. Football was `0` |
| Bet source | `source` | See §7. CSV truncated `OddsMatcher` to `Odds` |
| Mark as settled | **missing** | Form checkbox. Export so far only shows settled-looking rows. Need a Keep Open / unsettled sample |
| Keep Open | **missing** | Same |

Fingerprint for format detection: headers include `eventTime`,
`overallRunningTotal`, `monthlyRunningTotal`, `expectedProfit`.

Date parser: **`DD-MM-YYYY HH:MM:SS`** with padding spaces. Do not use
`Date.parse`.

For charts: use **`date`** (logged / settled in the tracker) for monthly
P&L. Store `eventTime` as kickoff when it differs.

---

## 4. The two fixture rows

| | Manual | Oddsmatcher football |
|--|--------|----------------------|
| eventTime | 16-08-2026 08:33 | 20-08-2026 19:00 (kickoff) |
| date | same | 16-08-2026 09:10 (logged) |
| bookmaker | 10bet | partypoker (back only; Smarkets lay dropped) |
| details | empty | Note |
| profit / actual | 9.67 | 0.00 |
| expected | 10 | 0 |
| outcome | Bet | Benfica (selection) |
| sport | Football | Football |
| event | Event | Benfica v AGF Aarhus |
| betType | Normal | Normal |
| source | Manual | Odds (OddsMatcher truncated) |

Running totals stayed 9.67 on the second row because actual profit was 0.
That is correct.

---

## 5. Bet type (locked from dropdown)

Oddsmonkey order:

2UP, Acca, Acca Lay at Start, Acca Lay Seq, Acca Lay Seq Free Bet, Acca
Lock-In, Acca No Lay, Advantage Play, Balance Adjustment, Bingo, Casino,
Dutch, Each Way, Extra Place, Free SNR, Free SR, Lucky Finder, Misc, Mug
Punt, Normal, Price Boost, Risk Free.

Import landing (history row, not a reconstructed desk object):

| Oddsmonkey | Edgeways |
|------------|----------|
| Normal | `back_only` (no stakes in CSV; do not pretend it is a live qualifier) |
| Free SNR | `free_snr` |
| Free SR | `free_sr` |
| Risk Free | `risk_free` |
| Dutch | `dutch` |
| Price Boost | `boost` |
| Mug Punt | `back_only` + `purpose: mug` |
| Each Way | `back_only` + `market: each_way` |
| Extra Place | `back_only` + `market: extra_place` |
| 2UP | `back_only` + metadata `omBetType: 2UP` (do not create a 2UP position) |
| Acca, Acca Lay at Start, Acca Lay Seq, Acca Lay Seq Free Bet, Acca Lock-In, Acca No Lay | `back_only` + metadata `omBetType` (do not create an acca run) |
| Advantage Play, Lucky Finder, Misc | `back_only` + metadata |
| Casino, Bingo | Prefer casino settlement if the row is clearly casino; else history bet + sport map. **Need a sample row** |
| Balance Adjustment | **Not a bet.** Map to a balance / P&L adjustment. **Need a sample row** |

Always keep the original Oddsmonkey bet type in import metadata so we can
filter “imported as Extra Place” even when the Edgeways type is coarser.

---

## 6. Sport (locked from dropdown)

Map into `src/lib/sports.ts` where we have a value; otherwise `other` or
casino.

| Oddsmonkey | Edgeways |
|------------|----------|
| American Football | `american_football` |
| Baseball | `baseball` |
| Basketball | `basketball` |
| Boxing | `boxing` |
| Cricket | `cricket` |
| Darts | `darts` |
| eSports | `esports` |
| Football | `football` |
| Golf | `golf` |
| Greyhounds | `greyhounds` |
| Horse Racing | `horse_racing` |
| Ice Hockey | `ice_hockey` |
| Motor Sport | `motorsport` |
| Rugby League | `rugby_league` |
| Rugby Union | `rugby_union` |
| Snooker | `snooker` |
| Tennis | `tennis` |
| Miscellaneous, Olympics, Politics, Virtual Sports | `other` (keep original label in metadata) |
| Bingo, Blackjack, Casino, Roulette, Slots | casino path / `other` until we see CSV rows |

---

## 7. Bet source (locked, we should keep it)

Form: None, OddsMatcher, Manual Entry, Casino Offer.

CSV so far: `Manual`, `Odds`.

Map:

| CSV / UI | Store as |
|----------|----------|
| None | `none` |
| Manual / Manual Entry | `manual` |
| Odds / OddsMatcher | `oddsmonkey_oddsmatcher` |
| Casino Offer | `oddsmonkey_casino_offer` |

Our bet `source` column stays `"import"` so EV exclusion keeps working.
Bet source is **origin metadata** (where they found the bet), shown in
history as e.g. “Imported from Oddsmonkey · Oddsmatcher”.

Yes, we should support this. It is useful and cheap.

---

## 8. Exchange (UI only, not in CSV)

Form: Select exchange, BetConnect Exchange, Betdaq Exchange, Matchbook
Exchange, Betfair Exchange, Pinnacle, Smarkets Exchange.

Pinnacle in an exchange list is their quirk. **CSV does not export this
field.** Do not invent a lay venue. If a later export adds a column, map
then.

---

## 9. Product rules (locked)

1. History only. No wallet moves. No EV capture. Store expected profit
   for display only.
2. Bank and bookies still required for new work.
3. Idempotent. Hash
   `(date, eventTime, bookmaker, actualProfit, event, outcome, details, betType, expectedProfit)`.
4. Real progress: `33 / 1,062 rows completed`.
5. Preview: counts, date range, sum of actual, unmapped enums.
6. Generic CSV remains in Settings.
7. Logos: nominative, “not affiliated”, not on the marketing homepage.
8. Label: `{event}` + selection (`outcome` unless it is the dummy `Bet`).
   Notes from `details`.

---

## 10. Architecture

```text
detectFormat(headers) → "oddsmonkey" | "outplayed" | "generic"
adapter.parse(rows)   → drafts + row errors
runner.commit(chunks) → progress events
```

Keep `source: "import"`. Add origin metadata: platform, omBetType,
omBetSource, selection, kickoff.

---

## 11. Waiting on Sam: fuller Oddsmonkey CSV (exactness pass)

Sam will build up the Oddsmonkey profit tracker so it accounts for all
record types, then send an updated Export Data CSV. **That file finishes
CSV exactness.** It is not a blocker for the rest of the first-run plan
(EDGE-62…67, empty Home, landing honesty, legal pages).

Until that CSV arrives:

- Parser core uses the two-row fixture (manual Normal + Oddsmatcher
  football).
- Unknown `betType` / sport → `back_only` / `other` + keep the original
  in metadata (never drop the row).
- Do not guess casino vs balance-adjustment routing.

When the new file lands, re-open EDGE-68 for an exactness pass: one row
per remaining bet type, unsettled / Keep Open, casino, Balance
Adjustment, Casino Offer as source, and as many bookies as appear.

Also still useful, not blocking: bookmaker-dropdown screenshot; Outplayed
sample CSV.

---

## 12. Implementation order

1. Parser + date format + two-row fixture test (can start now).
2. Sam: remaining variants + bookie list.
3. Preview + chunked commit + progress.
4. Empty Home + Settings, Oddsmonkey logo.
5. Idempotency.
6. Outplayed adapter when the sample arrives.
