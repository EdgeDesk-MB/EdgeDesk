# Offer Command Centre - Phase A

**Branch:** `feature/offer-command-centre`  
**Backup:** `main` + `backup/pre-offer-command-centre` @ `e3ca72f`  
**DB file backup:** `backups/edgedesk-*.db` (local only, not in git)

## North star

EdgeDesk answers three questions every day:

1. **What should I do next?** - best open offers / races / matches
2. **Am I executing it correctly?** - qualifying → free bet → conversion
3. **Did it actually pay?** - retained profit after commission, voids, retention

## Phase order (locked)

1. Offer Command Centre (pipeline + ranking + Home next-actions)
2. Bet organisation (campaigns, queues, settlement inbox)
3. Advantage surfaces (Racing Hunter / live football EV)
4. Platform (auth, desktop, sync)

## Phase A scope

### A1 - Next-action engine ✅
- Derive a single **next action** per active/planned offer from profit stage + expiry
- Rank actions for Home
- Surface on Home as “Next actions”
- Badge Offers in side nav when actions are waiting
- Offers page: **Needs action** filter + action chip on cards

### A2 - Offer pipeline UX ✅ (strip) / next: campaign P&L polish
- Stage chips on Offers cards (Planned → Qualifying → Awaiting → Awarded → Converting → Settled)
- Filter by “needs action”
- Next: richer campaign P&L header per offer

### A3 - Bet Desk queues ✅
- Tracker views: All · Open · Unlayed · Offer campaigns · Orphans
- Campaign grouping by `offerId` with campaign P&L
- Deep-link from Home next actions via `?offer=&queue=offers`

### A4 - Advantage ranking ✅
- Expected retained value ranking across active offers
- “Best next” callout on Home (above Next actions)

## Operator context (Sam)

- **Offer sources:** Matched Betting Blog primarily - no Oddsmonkey / Outplayed. Prefer paste/import + templates over scraping closed platforms.
- **Bookie access:** Many accounts gubbed - track *available* bookies explicitly; don’t assume full UK bookie set.
- **Core play:** Dutch 2UP offers - hope a team goes 2 clear then fails to win. 2UP Desk EV is often sobering vs gut feel (dutch vs lay honesty); lean into model honesty, not optimism.
- **Calendar preference:** Day-split lists (Today / Tomorrow / weekday), not month grids.

## Phase B - Close the loop (priority order)

1. **2UP dutch campaign** (World Cup timing) - largely done
   - Fixtures → 2UP Desk deep-link ✅
   - Gubbed-aware bookie pickers ✅
   - Competition filter (World Cup) ✅
   - Mixed 2UP/1UP dutch + structure ranker ✅
   - Clear “generous price vs covered dutch” copy ✅
2. **Available-bookie filter on Offers** ✅
3. **Settlement inbox** (Tracker → Settle queue) ✅
4. **Offer capture from MBB-style paste / templates** ✅
5. **Month-end / export polish** ✅ (monthly P&L + offers CSV)
6. **OCR screenshot import** - deprioritized (flaky; not a core path). Keep as optional fallback only.

## Phase A+ fixes
- ✅ Don’t auto-complete offers while free bet still needs converting
- ✅ Reopen wrongly completed campaigns on sync
- ✅ Day-split offer calendar (14-day horizon)
- ✅ Free-bet orphan linking without requiring bookie match
- ✅ Bookie accessStatus (available / gubbed / closed) + notes

## Design rules (keep consistent)

- Page shell + desk headers for full pages
- Home uses overview band + section panels with scroll fades
- Free-bet purple only for free-bet semantics
- Settlement win/loss: directional tint, not flat fill
- Prefer page tokens (`--page`, `--layout-*`) over one-off spacing

## Do not do in Phase A / B focus

- Arb / Kelly / Asian handicap
- Full offer scraping
- Auth / Tauri (Phase D)
- New exchange APIs
- Heavy OCR investment
