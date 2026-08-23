# D8 — Staged licensing: comply-on-contact

> Locked **23 Aug 2026**. Decision owner: Sam. Amends D7's EDGE-45 framing
> (ask-first) for launch stage. D7 itself (operator-held keys, never BYOK)
> stands unchanged.

## The decision

Edgeways launches with operator-held pooled feeds **without** written
redistribution permission, and resolves licensing **when approached**, from
reserved revenue. We do not email providers for permission in advance.

Rationale: this is a self-funded home build. Commercial data licensing
(Betfair Vendor £1,499 + certification; Flutter data licences bespoke) is
unaffordable at launch, and customers need live-updating odds for the
product to be worth paying for. At tens of subscribers the realistic
downside on the data feeds is a cease-and-desist and an account closure —
a terms matter, not a legal claim — and the product already degrades
cleanly (demo / paste / manual settle).

## Per-provider posture

| Provider | Launch posture | Why |
|----------|----------------|-----|
| The Racing API | Pooled feed live, quietly. No permission email. | Worst case is C&D + account closure; degrade path exists (demo racecards, manual settle). |
| API-Football | Pooled feed live, quietly. No permission email. | Same shape; football is the secondary sport so a refusal costs least. |
| Betfair / Flutter | **Delayed data only, as today. No live pooled prices.** No personal live key is ever fanned out. | Betfair actively detect and block commercial fan-out, and the blast radius includes Sam's personal exchange account — that downside cannot be fixed with reserved revenue. Live pooled prices wait for a real licence conversation funded by revenue. |

## Why not ask first (EDGE-45 reframed)

Asking first is the worst of both worlds at this stage: it puts us on the
provider's radar, and a "no" (or silence) on file converts any later use
from naive breach into knowing breach. The drafted permission emails stay
on file **unsent** (`docs/legal/provider-permission-emails.md`, reworked as
response templates). If a provider ever makes contact, the play is: comply
within days, flip that feed to its degrade path, and open the licensing
conversation from revenue. The drafts are the starting point for that
reply.

EDGE-45 becomes "respond fast and licence if approached", not "obtain
permission up front".

## Exposure hygiene (shipped 23 Aug)

The product never names data providers in customer-facing copy. Feeds are
"racing feed", "football feed", "exchange feed" in Settings, Racing Desk,
EP Desk, Help and the in-app roadmap. Exchange *account* names (a
customer's own Betfair wallet) are untouched — that is the customer's
venue, not our data source. Feeds stay behind login; marketing never names
or implies a provider.

This is crook-mitigation, not concealment from providers: a paying
customer has no reason to know or report which vendor supplies the odds,
and the surface for a bad-faith report is minimised.

## Reserve

The first ~£1,000 of MRR is earmarked as the licensing reserve so "resolve
immediately" is literally true if a provider gets in touch.

## Revisit triggers

- Any provider contact → comply + licence conversation (EDGE-45 activates).
- Betfair live prices wanted → Flutter Vendor / Company Exchange Data
  licence, funded (EDGE-14).
- ~£1k MRR sustained → reconsider asking properly, from strength.
