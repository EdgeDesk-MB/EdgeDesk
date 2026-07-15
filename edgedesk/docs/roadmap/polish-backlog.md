# Polish backlog

Small UX tweaks harvested from real daily use - not roadmap features, not §9 ideas.
Sam batches these up and hands them over "for the right occasion"; fix in sweeps.

| # | Observed | Fix direction | Status |
|---|----------|---------------|--------|
| P1 | Tapping an "offer expiring with EV unclaimed" push notification lands on the Add bet flow instead of showing the offer | The `offer_expiring` alert rule uses the Do next item's href (`rules.ts:100`, tracker/add-bet oriented); it should deep-link to the offer campaign details modal instead (needs an `/offers?view=<offerId>` style param that opens `viewOffer` on load) | ✅ Done 2026-07-15 — rule emits `/offers?view=<id>`, offers page opens `viewOffer` once and strips the param |
| P2 | Mobile quick menu only offered bet capture | Quick actions grid added to the quick-log sheet: New offer, Add balance, Matched calc, Casino offer, Track fixture — every global modal reachable without navigation | ✅ Done 2026-07-15 (Sam's request) |
| P3 | Casino page had no help entry | `casino` PageHelpId + header `?` wired; site map already lists Casino via NAV_SECTIONS | ✅ Done 2026-07-15 |
