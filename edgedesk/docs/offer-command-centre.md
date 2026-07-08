# Offer Command Centre — Phase A

**Branch:** `feature/offer-command-centre`  
**Backup:** `main` + `backup/pre-offer-command-centre` @ `e3ca72f`  
**DB file backup:** `backups/edgedesk-*.db` (local only, not in git)

## North star

EdgeDesk answers three questions every day:

1. **What should I do next?** — best open offers / races / matches
2. **Am I executing it correctly?** — qualifying → free bet → conversion
3. **Did it actually pay?** — retained profit after commission, voids, retention

## Phase order (locked)

1. Offer Command Centre (pipeline + ranking + Home next-actions)
2. Bet organisation (campaigns, queues, settlement inbox)
3. Advantage surfaces (Racing Hunter / live football EV)
4. Platform (auth, desktop, sync)

## Phase A scope

### A1 — Next-action engine ✅
- Derive a single **next action** per active/planned offer from profit stage + expiry
- Rank actions for Home
- Surface on Home as “Next actions”
- Badge Offers in side nav when actions are waiting
- Offers page: **Needs action** filter + action chip on cards

### A2 — Offer pipeline UX ✅ (strip) / next: campaign P&L polish
- Stage chips on Offers cards (Planned → Qualifying → Awaiting → Awarded → Converting → Settled)
- Filter by “needs action”
- Next: richer campaign P&L header per offer

### A3 — Bet Desk queues ✅
- Tracker views: All · Open · Needs lay · Offer campaigns · Orphans
- Campaign grouping by `offerId` with campaign P&L
- Deep-link from Home next actions via `?offer=&queue=offers`

### A4 — Advantage ranking
- Expected retained value ranking across active offers
- “Best next” callout on Home

## Design rules (keep consistent)

- Page shell + desk headers for full pages
- Home uses overview band + section panels with scroll fades
- Free-bet purple only for free-bet semantics
- Settlement win/loss: directional tint, not flat fill
- Prefer page tokens (`--page`, `--layout-*`) over one-off spacing

## Do not do in Phase A

- Arb / Kelly / Asian handicap
- Full offer scraping
- Auth / Tauri (Phase D)
- New exchange APIs
