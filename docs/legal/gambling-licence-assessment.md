# Gambling licence self-assessment — Edgeways

**Date:** 11 Aug 2026 · **Status:** Self-assessment evidence file (EDGE-8, re-scoped)
**Not legal advice.** This memo documents our own analysis and the public
precedent. A solicitor letter is held in reserve — see "Triggers" below.

---

## 1. What Edgeways is

A consumer software product (PWA): matched betting calculators, bet/track
organisers, profit & loss ledgers, offer calendars and (later) odds displays.
At no point does Edgeways:

- take, accept, or settle a wager;
- hold, stake, or transmit customer betting funds;
- match bets between users (no exchange/intermediary function);
- supply software to any licensed gambling operator.

Users place every bet themselves, in their own accounts, with licensed
bookmakers/exchanges. The browser extension pre-fills a betslip in the user's
own session at their own click — the bet is still placed by the user, on the
operator's site, under the operator's licence.

## 2. Legal framework (Great Britain)

- **Gambling Act 2005, s.33** — an operating licence is required for
  "providing facilities for gambling". The Gambling Commission's own remit
  statement: *"We license and regulate the individuals and businesses that
  provide gambling in Great Britain."* Edgeways provides no gambling
  facilities: the facility (the bet) is provided entirely by the licensed
  bookmaker/exchange.
- **Gambling software licence** — a B2B licence for businesses that
  "manufacture, supply, install or adapt gambling software **for use by
  operators [the Commission] license**" (GC licence pages, checked 11 Aug
  2026). Edgeways supplies consumers, not operators, and the software does
  not conduct gambling. Outside scope.
- **Betting intermediary provisions** — apply to parties who provide
  facilities for people to bet *with each other*. Edgeways has no P2P
  function. Outside scope.

## 3. The strongest counterargument — addressed

Edgeways is more than a passive tracker: it recommends stakes and sequences
(qualifying bets, lay stakes, bonus extraction). This is exactly what every
UK matched betting service does, and it remains **advice and information
about gambling, not facilities for gambling**. The bet is always struck on
the operator's platform under the operator's licence. No provision of the
Act, and no GC guidance found (checked 11 Aug 2026), treats advisory or
calculation software as providing facilities for gambling.

## 4. Precedent

OddsMonkey, Profit Accumulator, Outplayed, Team Profit and similar UK
matched betting services have operated **unlicensed for 15+ years** with no
Gambling Commission enforcement against matched betting software or
services. The Commission's 2026 rule changes (bonus wagering caps from
19 Jan 2026, ASA ad-monitoring notices, deposit-limit presentation) all
target **operators**, not tools.

## 5. Adjacent exposures (not gambling licensing — tracked separately)

| Exposure | Real rule-set | Where handled |
|---|---|---|
| Payment processor acceptance | Stripe restricted-business policy | EDGE-1 |
| Marketing claims ("risk-free profit") | ASA / CAP advertising codes | Marketing review before launch push |
| Subscription auto-renewal, refunds, cooling-off | Consumer Contracts Regs / CRA 2015 | Terms of Service draft (EDGE-11); public `/terms` + signup checkbox (EDGE-61) |
| Data protection | UK GDPR | ICO registration (EDGE-9), Privacy Policy draft (EDGE-12); public `/privacy` + waitlist notice (EDGE-61) |
| Pooled odds redistribution | Provider contracts / IP | EDGE-45 |

## 6. Conclusion

On the current product scope, **Edgeways requires no Gambling Commission
operating licence, no gambling software licence, and no betting intermediary
licence.** Confidence: high, based on the statutory tests, the Commission's
published licence scope, and 15+ years of unenforced industry precedent.

## 7. Triggers — re-run this assessment (or instruct a solicitor) if any fire

1. **Any feature that places bets on the user's behalf server-side** (e.g.
   API-placed exchange bets) — materially changes the s.33 analysis. The
   BYOK betslip-fill extension does not trigger this; server-placed bets would.
2. **Pooled/redistributed odds feeds** (EDGE-45) — re-check before shipping.
3. **Stripe, a bank, or any processor requests legal comfort** during
   underwriting (EDGE-1).
4. **The Gambling Commission publishes guidance** on matched betting
   services or advisory software.
5. **A major marketing push with earnings claims** — that review is
   advertising/consumer law (different specialism), not gambling licensing.

Estimated cost if a trigger fires: £150–750 fixed-fee advice. Until then: £0.

## 8. Optional due-diligence step — Gambling Commission correspondence

Sam may email the GC contact centre (published address:
info@gamblingcommission.gov.uk — verify on their Contact page) asking for
their view. Even a "we cannot advise, seek legal advice" reply documents
due diligence. Draft:

> Hello,
>
> I run a UK software business launching a consumer productivity app for
> matched bettors: calculators, bet tracking and profit/loss ledgers. The
> app never takes bets, never holds customer funds, and has no peer-to-peer
> function — users place all bets themselves with licensed operators.
>
> My reading of the Gambling Act 2005 is that no operating licence (including
> the gambling software licence) is required for this activity, consistent
> with the long-standing unlicensed operation of similar UK matched betting
> services. Could you confirm whether the Commission agrees, or point me to
> any relevant guidance?
>
> Many thanks.

---

## 9. Gibraltar / Oddsmonkey (checked 16 Aug 2026)

Oddsmonkey’s Terms of Use: site operated by Liquidity Trading Limited,
Gibraltar company 122680, Madison Building, Midtown, Queensway GX11 1AA.
Their footer describes them as an aggregator of operator sites licensed by
the Gambling Commission.

That is an affiliate / discovery business in the Gibraltar e-gaming cluster.
It is **not** evidence that Edgeways needs a Gibraltar company, and it is
**not** a blocker. UK consumer law still applies to UK customers. Stay UK.
Company form is EDGE-15 (sole trader vs Ltd). Do **not** copy their
aggregator line onto Edgeways legal pages.

---

*Filed per EDGE-8 re-scope (11 Aug 2026): evidence file first, solicitor on
trigger. Review whenever a trigger fires, and in any case before EDGE-45.
Gibraltar note added 16 Aug 2026 after Oddsmonkey ToS review.*
