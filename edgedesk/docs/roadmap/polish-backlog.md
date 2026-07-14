# Polish backlog

Small UX tweaks harvested from real daily use - not roadmap features, not §9 ideas.
Sam batches these up and hands them over "for the right occasion"; fix in sweeps.

| # | Observed | Fix direction | Status |
|---|----------|---------------|--------|
| P1 | Tapping an "offer expiring with EV unclaimed" push notification lands on the Add bet flow instead of showing the offer | The `offer_expiring` alert rule uses the Do next item's href (`rules.ts:100`, tracker/add-bet oriented); it should deep-link to the offer campaign details modal instead (needs an `/offers?view=<offerId>` style param that opens `viewOffer` on load) | Harvested 2026-07-14 |
