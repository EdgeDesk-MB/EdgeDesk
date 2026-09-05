# Growth playbook — Edgeways

> How Edgeways gets its first 10, 100 and 1,000 paying customers.
> Written 4 Sep 2026, the day production went live. Commercial terms:
> `docs/strategy/subscriptions.md`. Launch ops: `docs/live-readiness.md`.
> Review monthly; tick off plays as they ship, exactly like
> `docs/follow-this-plan.md`.

---

## 0. What we are selling, in one breath

Edgeways is the **command centre** for matched bettors: it answers "what
next?", "am I executing correctly?" and "did it actually pay?". It is **not**
an oddsmatcher and does not send bookie offers. It supplements the finders
(OddsMonkey, Outplayed, Profit Accumulator) and replaces the spreadsheet.

That positioning is the whole growth strategy. Every play below either:

1. finds people who already matched bet and hate their spreadsheet, or
2. finds people the finders just signed up who are about to drown in admin.

We never compete with finders on "we find offers". We win on "your day,
run properly, with proof it paid".

### Who the customer is (three personas)

| Persona | Where they live | What hurts | Our hook |
|---------|-----------------|------------|----------|
| **Spreadsheet Sam** | r/matchedbetting, MSE forum, Discord | Self-built sheet is breaking, no idea of true P&L | "Your spreadsheet, but it settles itself" |
| **Finder subscriber** | OddsMonkey / Outplayed members, their forums and Facebook groups | Has offers, no command centre; profit tracking is a mess | "The desk that runs the day your finder hands you" |
| **Curious newcomer** | YouTube, TikTok, beermoney UK | Overwhelmed, scared of mistakes | Free calculators + demo desk, learn by doing |

Persona 1 and 2 pay. Persona 3 is the top of funnel and the SEO audience.

---

## 1. The funnel (and what we measure)

```text
Discover (community, search, video, referral)
   → Try (public /demo, free calculators, Free tier)
     → Activate (first offer tracked and settled on their desk)
       → Pay (14-day Edge trial → Core £9.99 or Edge £24.99)
         → Refer (EDGE-67 codes, results screenshots)
```

**North star: weekly active desks** (a desk with at least one bet settled
that week). Everything else is a leading indicator:

| Stage | Metric | Where |
|-------|--------|-------|
| Discover | Unique visitors to `/` and `/demo` | PostHog web analytics |
| Try | Sign-ups, demo desk sessions | PostHog |
| Activate | % of new accounts settling a first bet within 7 days | PostHog funnel |
| Pay | Trial → paid conversion, Core vs Edge mix | Stripe + PostHog |
| Refer | Referral sign-ups per paying customer | PostHog, once EDGE-67 ships |

**Activation is the lever.** A matched bettor who settles one real bet on
the desk has felt the product. One who only pokes the demo has not. Every
onboarding improvement (EDGE-62…68 already shipped or specced) serves this.

---

## 2. Ground rules (read before any marketing)

These are constraints from our legal position. Breaking them costs real money.

1. **No earnings claims, ever.** Never "make £500/month". Say "track what it
   actually paid". The ASA/CAP code applies to gambling-adjacent marketing,
   and our ToS position is that we are software, not a tipster.
2. **18+ and BeGambleAware messaging** on anything promotional, matching the
   in-app gate (EDGE-13). Never use imagery that could appeal to under-25s.
3. **No paid ads at scale until the trademark question is resolved.**
   UK00004101707 EDGEWAYS (Flutter) exists in Class 9 (EDGE-10). Organic
   community, SEO and partnerships are safe. A Google/Meta ads account is a
   trigger for a letter. This is why the playbook is organic-first.
4. **We are not an operator or aggregator.** Do not copy OddsMonkey's
   "licensed by the Gambling Commission" line
   (`docs/legal/gambling-licence-assessment.md`). We never take a wager.
5. **No incentivised public reviews without disclosure.** The feedback
   thank-you credit (one extra month) is for in-app product feedback only,
   never traded for Trustpilot stars (`docs/strategy/subscriptions.md`).
6. **Be a good community citizen.** Reddit and forums ban drive-by promo.
   The rule everywhere: help first, disclose affiliation, link only when
   asked or when rules allow.

---

## 3. Phase 0 — Foundations (week 1, before any outreach)

Cheap, one-time, and everything else compounds on top of them.

- [ ] **Analytics events for the funnel.** Confirm PostHog captures:
      homepage visit → demo view → sign-up → first bet settled → checkout
      start → paid. Build one funnel insight and pin it. You cannot grow
      what you cannot see.
- [ ] **Referral codes (EDGE-67).** The single highest-ROI growth feature
      for this niche. Matched bettors talk to matched bettors constantly.
      Confirm the 50% / £9.99 mechanic and ship it before outreach starts,
      so every early customer becomes a channel.
- [ ] **SEO basics on the marketing site.** Unique title/meta per page,
      sitemap, OG images, `edgeways.app` verified in Google Search Console.
      Target the phrase family: "matched betting tracker", "matched betting
      spreadsheet alternative", "matched betting profit tracker".
- [ ] **Trustpilot profile claimed** (free). Do not solicit yet; just exist
      so early happy users have somewhere to go.
- [ ] **A shareable results card.** The product already shows "did it pay".
      Make one screenshot-worthy artefact (weekly Edge Report summary) that
      users *want* to post. This is the referral loop's fuel. Size it as a
      small roadmap item.
- [ ] **Founding-member list activation.** The waitlist rows on Neon are
      warm. One personal email: we are live, your Founding price (3 months
      Edge at £9.99) is waiting, here is the link. This is the fastest
      first-10-customers play in the whole document.

**Exit criteria:** funnel dashboard live, referral codes shipped, Search
Console verified, founding email sent.

---

## 4. Phase 1 — Community-led, first 50 customers (weeks 2–6)

Matched betting is a *community niche*. The customers are already gathered.
The play is presence, not broadcast.

### 4.1 Reddit (r/matchedbetting, r/beermoney_uk)

- [ ] Become a real account. Answer questions for two weeks before ever
      mentioning Edgeways: settlement confusion, P&L tracking, 2UP maths,
      free-bet expiry. These are exactly our product's questions.
- [ ] When tracking/spreadsheet threads appear (they appear weekly), reply
      with genuine help and, where rules allow, "I built a desk for this,
      happy for feedback, link in profile". Disclose you are the maker.
- [ ] One "I built this" post, in a subreddit whose self-promo rules allow
      it, framed as a builder asking for critique, not a launch blast.
      Maker-humble beats marketer-loud in this niche every time.

### 4.2 Forums and Facebook groups

- [ ] MoneySavingExpert matched betting thread: long-lived, high-intent.
      Same help-first pattern. Signature links where permitted.
- [ ] OddsMonkey / Outplayed member forums and Facebook groups: we are a
      *complement*, so this is not poaching. Position as "the desk for the
      offers your finder hands you". Respect each group's promo rules; some
      have a weekly promo thread, use only that.

### 4.3 Discord

- [ ] Join the active matched betting servers. Lurk, help, and ask two or
      three power users if they would trial the desk and tear it apart.
      Their feedback is EDGE-33's stranger test, multiplied.

### 4.4 The personal network

- [ ] Anyone Sam knows who matched bets, or did and quit because of the
      admin. The quitters are gold: "the admin killed it for me" is our
      exact value proposition. Personal message, Founding price, ask for
      brutal feedback.

**Weekly cadence for this phase:** 30 minutes a day, every day, helping in
one community. Two substantive posts or answers per day minimum. This is
the job. It does not scale, and it does not need to: it buys the first 50
customers and, more importantly, the language customers actually use, which
feeds Phase 2.

**Exit criteria:** 50 paying customers, or six weeks elapsed, whichever
first. Every customer asked: "where did you hear about us?" (attribution
question already in onboarding, EDGE-62).

---

## 5. Phase 2 — Content and SEO engine (weeks 4–16, overlaps Phase 1)

Competitors rank for "how to matched bet". We cannot out-content their
teams on generic guides, and we should not try. We own the **execution and
proof** long tail they ignore.

### 5.1 Free tools as lead magnets (highest priority)

Free calculators are the classic, proven acquisition play in this niche
(OddsMonkey and Outplayed both grew on them). Each tool is a landing page
that ranks, solves one problem instantly, and ends with "this, but
automatic, on your desk".

- [ ] Lay stake / qualifying loss calculator
- [ ] Free bet (SNR and SR) calculator
- [ ] 2UP calculator
- [ ] Each-way / extra place calculator
- [ ] Accumulator lay-sequential calculator
- [ ] "True P&L" explainer with a worked example

Each is a small, well-tested calc surface (the engine already exists in
`src/lib/calc`). Ship one per fortnight. These pages are permanent assets
that compound; community posts decay in days.

### 5.2 Comparison and alternative pages

High purchase intent, low volume, easy to rank:

- [ ] "Matched betting spreadsheet alternatives"
- [ ] "How to track matched betting profit properly"
- [ ] Honest "Edgeways vs doing it in a spreadsheet" page. Do **not** do
      "vs OddsMonkey" attack pages; we complement finders and want their
      ecosystems friendly.

### 5.3 Video (YouTube first, TikTok/Shorts second)

Matched betting is a proven YouTube niche; newcomers learn there.

- [ ] Short screen-recordings of the desk doing its three jobs: "what
      next", "did it pay", settling a 2UP. No face needed. 60–90 seconds.
- [ ] One "I built a matched betting command centre, here is why" maker
      video. Authenticity is the moat against the corporate finders.
- [ ] Post the same clips as Shorts/TikTok. Always 18+ framing, never
      earnings claims (§2).

**Cadence:** one calculator or article per fortnight, one video per month.
Slow is fine. Consistency beats volume.

**Exit criteria:** three calculators live and indexed, first page-1 ranking
for any target phrase, measurable demo→signup traffic from content.

---

## 6. Phase 3 — Partnerships and referrals (months 2–6)

### 6.1 Referral programme (the engine)

Once EDGE-67 is live and Phase 1 customers exist:

- [ ] In-app prompt after a user's **first settled profitable week**, the
      moment of maximum goodwill: "Know someone drowning in a spreadsheet?"
- [ ] Referrer and referee both get something (confirm the 50% / £9.99
      mechanic in EDGE-67). Two-sided always outperforms one-sided.
- [ ] Track referrals-per-customer in PostHog. Target: 0.3+ within three
      months. Below that, the ask or the reward is wrong, iterate.

### 6.2 Complementary partnerships

- [ ] **Matched betting content creators** (YouTube, bloggers, newsletter
      writers): affiliate deal or free Edge for honest coverage. Small
      creators first; they answer emails and their audiences trust them.
- [ ] **Offer finders, carefully.** Long term, a finder could see Edgeways
      as the desk that makes *their* subscribers stickier. Do not pitch
      this until we have retention numbers worth showing. Note: some
      finders have their own trackers, so treat as opportunistic, not core.
- [ ] **Betting-exchange adjacent communities** (Betfair trading forums):
      the Edge tier's exchange features speak their language.

### 6.3 Reviews and social proof

- [ ] Once ~20 happy paying customers exist, one in-app ask: "Enjoying the
      desk? A Trustpilot review helps a solo maker enormously." No reward,
      no gating, disclosure rules respected (§2.5).
- [ ] Screenshot-worthy results card (Phase 0) becomes the organic social
      proof loop: users post their week, the bolt watermark does the rest.

---

## 7. Phase 4 — Paid acquisition (only when earned)

Deliberately last, and gated:

1. **Trademark resolved or risk accepted in writing** (EDGE-10). Paid ads
   are the trigger for Flutter's attention.
2. **Unit economics proven:** trial→paid conversion and 3-month retention
   known from Phases 1–3, so we know what a customer is worth.
3. **Gambling-adjacent ad policies cleared:** Google requires gambling
   certification for much of this space; Meta restricts it. Our "software,
   never takes a wager" description (live-readiness §3.1) is the basis of
   any application.

When those clear: branded search defence first, then "matched betting
tracker" search terms, then creator sponsorships (which behave like paid
but with trust attached). Budget from Edge revenue, not before.

---

## 8. The weekly operating rhythm

Bolt this onto `docs/follow-this-plan.md` as the growth thread.

| Day | 30–45 min block |
|-----|-----------------|
| Mon | Metrics: funnel dashboard, last week's sign-ups/activations/revenue. One sentence in a running log. |
| Tue | Community: two helpful answers, one thread started. |
| Wed | Content: work on the current calculator/article/video. |
| Thu | Community: two helpful answers. Reply to every mention of Edgeways anywhere. |
| Fri | Customers: read all feedback rows, message one customer personally, log one insight to Linear (Marketing label). |

**Monthly:** review this playbook. What produced sign-ups? Do more of it.
What produced nothing after a fair trial (four weeks)? Stop it without
sentiment. Update the funnel targets.

---

## 9. What success looks like

| Milestone | Target date | Signal |
|-----------|-------------|--------|
| First 10 paying | End Sep 2026 | Founding email + personal network |
| 50 paying | Mid Oct 2026 | Community plays converting, referral loop live |
| 100 paying | End Nov 2026 (original M3) | Content ranking, referrals >20% of new sign-ups |
| Run-rate covered | 3 subscribers covers infra (live-readiness §7) | Already near-certain |
| 1,000 paying | 2027 | Phase 3/4 engines, not hustle |

The first 50 customers come from showing up where they already are. The
next 950 come from systems (content, referrals, partnerships) built while
earning those 50.

---

## 10. Anti-playbook (things that feel like growth but are not)

- Buying ads before Phase 4 gates clear (trademark + policy risk).
- Building features "for marketing" before referral codes and the results
  card, the two features that *are* marketing.
- Earnings-claim copy. One ASA complaint or GC-adjacent headline is an
  existential risk for a sole trader in this niche.
- Chasing persona 3 (newcomers) with paid effort before personas 1–2 are
  converting. Newcomers churn; spreadsheet sufferers pay.
- Launching on Product Hunt / HN. Wrong audience, one-day spike, and the
  gambling-adjacent framing invites the worst possible comment section.
