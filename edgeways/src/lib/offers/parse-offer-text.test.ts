import { describe, expect, it } from "vitest";
import { parseOfferFromText } from "./parse-offer-text";

describe("parseOfferFromText", () => {
  it("parses MBB-style racing place-refund paste", () => {
    const draft = parseOfferFromText(`
Betfair Sportsbook
Bet £50 get £50 free bet if 2nd, 3rd or 4th
Min 8 runners · UK & Ireland
Expected profit: £12
Expires 31/07/2026
`);
    expect(draft.category).toBe("horse_racing");
    expect(draft.bookmaker).toBe("Betfair Sportsbook");
    expect(draft.betStake).toBe(50);
    expect(draft.freeBetAmount).toBe(50);
    expect(draft.qualifyingPlaces).toEqual([2, 3, 4]);
    expect(draft.minRunners).toBe(8);
    expect(draft.rules?.type).toBe("bet_get_free_place");
    expect(draft.rules?.repeatSameDay).toBeUndefined();
    expect(draft.expectedProfit).toBe(12);
    expect(draft.expiresAt).toBeTruthy();
    expect(draft.confidence).toBe("high");
  });

  it("sets repeatSameDay when paste says unlimited / every race", () => {
    const draft = parseOfferFromText(`
Paddy Power
Bet £10 get £10 free bet if 2nd or 3rd
Available on every race today · unlimited place refunds
Min 8 runners · UK & Ireland
`);
    expect(draft.category).toBe("horse_racing");
    expect(draft.qualifyingPlaces).toEqual([2, 3]);
    expect(draft.rules?.repeatSameDay).toBe(true);
    expect(draft.notes.some((n) => /multiple times today/i.test(n))).toBe(true);
  });

  it("does not set repeatSameDay from bare per-race stake wording", () => {
    const draft = parseOfferFromText(`
Tote
Money Back 2nd & 3rd
Get up to £10 back as a free bet if your horse finishes 2nd or 3rd
First cash win only per race. Min 5 runners.
`);
    expect(draft.rules?.qualifyingPlaces).toEqual([2, 3]);
    expect(draft.rules?.repeatSameDay).toBeUndefined();
  });

  it("parses football welcome offer with min odds and time expiry", () => {
    const draft = parseOfferFromText(`
Sky Bet
Bet £10 get £30 free bet - Premier League
Min odds 1/2 · New customers only
Expires 31 Jul 2026 at 11:59pm
`);
    expect(draft.category).toBe("football");
    expect(draft.bookmaker).toBe("Sky Bet");
    expect(draft.betStake).toBe(10);
    expect(draft.freeBetAmount).toBe(30);
    expect(draft.title).toBe("Bet £10 get £30 free bet (Football)");
    expect(draft.important.minOdds).toBe(1.5);
    expect(draft.important.importantNotes).toMatch(/New customers only/i);
    const d = new Date(draft.expiresAt!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(31);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });

  it("parses casino deposit match as casino", () => {
    const draft = parseOfferFromText(`
Bet365 Casino
100% deposit match up to £100 + 50 free spins
Expires 15/08/2026 at 23:00
`);
    expect(draft.category).toBe("casino");
    expect(draft.expiresAt).toBeTruthy();
    const d = new Date(draft.expiresAt!);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(0);
  });

  it("parses unconditional sign-up free bet as general when no sport cues", () => {
    const draft = parseOfferFromText(`
Coral
Bet £20 get £20 free bet
No place conditions - welcome offer
`);
    expect(draft.category).toBe("general");
    expect(draft.bookmaker).toBe("Coral");
    expect(draft.betStake).toBe(20);
    expect(draft.freeBetAmount).toBe(20);
    expect(draft.qualifyingPlaces).toEqual([]);
  });

  it("parses £50FB 2nd-4th shorthand as racing", () => {
    const draft = parseOfferFromText("Ladbrokes - £50FB 2nd-4th · 8+ runners");
    expect(draft.category).toBe("horse_racing");
    expect(draft.bookmaker).toBe("Ladbrokes");
    expect(draft.freeBetAmount).toBe(50);
    expect(draft.qualifyingPlaces).toEqual([2, 3, 4]);
    expect(draft.minRunners).toBe(8);
  });

  it("does not treat min runners as min odds", () => {
    const draft = parseOfferFromText(
      "Betfair - Bet £20 get £20 free if 2nd-4th · Min 8 runners · Min odds 2.0"
    );
    expect(draft.category).toBe("horse_racing");
    expect(draft.minRunners).toBe(8);
    expect(draft.important.minOdds).toBe(2);
  });

  it("parses MBB qualifying window with UK DD/MM times and free bet value", () => {
    const now = new Date(2026, 6, 8, 12, 0, 0); // 8 Jul 2026
    const draft = parseOfferFromText(
      `Opt-in required. Qualifying period runs from 09:00am 01/07 – 19:00pm 11/07. Free Bet value is £10. Valid 7 days on any Cricket match. Free Bet restricted to selection with min odds of 1/2 (1.5). Cash bet only. Min odds 1/2 (1.5) on Singles or Multis. Exclusions & T&Cs apply.`,
      now
    );
    expect(draft.category).toBe("cricket");
    expect(draft.freeBetAmount).toBe(10);
    expect(draft.expectedProfit).toBe(7.5);
    expect(draft.important.minOdds).toBe(1.5);
    expect(draft.important.importantNotes).toMatch(/Opt-in required/i);
    expect(draft.important.importantNotes).toMatch(/Cash bet only/i);
    expect(draft.expiresAt).toBeTruthy();
    const d = new Date(draft.expiresAt!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July
    expect(d.getDate()).toBe(11);
    expect(d.getHours()).toBe(19);
    expect(d.getMinutes()).toBe(0);
    expect(draft.title).toMatch(/£10 free bet/i);
  });

  it("parses UK DD/MM/YYYY expiry with time before date", () => {
    const draft = parseOfferFromText(
      "Coral Bet £20 get £20 free bet. Expires 23:59 15/08/2026"
    );
    expect(draft.expiresAt).toBeTruthy();
    const d = new Date(draft.expiresAt!);
    expect(d.getDate()).toBe(15);
    expect(d.getMonth()).toBe(7);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });

  it("parses valid until named UK date", () => {
    const draft = parseOfferFromText(
      "Ladbrokes £25 free bet. Valid until 3rd September 2026 at 9pm"
    );
    expect(draft.freeBetAmount).toBe(25);
    expect(draft.expectedProfit).toBe(18.75);
    const d = new Date(draft.expiresAt!);
    expect(d.getDate()).toBe(3);
    expect(d.getMonth()).toBe(8);
    expect(d.getHours()).toBe(21);
  });

  it("parses Tote Money Back 2nd & 3rd screenshot paste", () => {
    const now = new Date(2026, 6, 9, 12, 0, 0);
    const draft = parseOfferFromText(
      `Money Back
Money Back 2nd & 3rd
Get up to £10 back as a free bet if your horse finishes 2nd or 3rd in the 3pm at Newmarket today
Opt-in here

Money Back 2nd & 3rd:
Online only. Eligibility restrictions apply. Opt-in required. Place a cash win or EW bet on any qualifying race and get the same value up to £/€10 in Tote Credit if the selection comes 2nd or 3rd. Applies to customers' first cash win and win part of EW bets only per race. Min 5 runners must start. Credited within 24 hours of bet settlement. 7-day expiry. Full T&Cs apply. 18+. GambleAware.org.`,
      now
    );
    expect(draft.category).toBe("horse_racing");
    expect(draft.bookmaker).toBe("Tote");
    expect(draft.title).toBe("Money Back 2nd & 3rd");
    expect(draft.freeBetAmount).toBe(10);
    expect(draft.betStake).toBe(10);
    expect(draft.qualifyingPlaces).toEqual([2, 3]);
    expect(draft.minRunners).toBe(5);
    expect(draft.scopeMode).toBe("race");
    expect(draft.scopeCourse).toBe("Newmarket");
    expect(draft.preferredOffTime).toBe("15:00");
    expect(draft.eventDate).toBe("2026-07-09");
    expect(draft.expectedProfit).toBe(7.5);
    expect(draft.important.importantNotes).toMatch(/Opt-in required/i);
    expect(draft.important.importantNotes).toMatch(/valid 7 days/i);
    expect(draft.important.minOdds).toBeNull();
    expect(draft.rules?.qualifyingPlaces).toEqual([2, 3]);
  });

  it("parses BetMGM money-back-if-loses as Refund-If, not bet&get", () => {
    const draft = parseOfferFromText(`
BetMGM
MONEY BACK AS A FREE BET IF YOUR HORSE LOSES
13:25 Goodwood. Max stake £100. Min odds 1/2 (1.50).
Each way excluded. Free bet valid 3 days. Cash out voids offer. SNR.
Money Back as a Free Bet will only occur if your bet loses. Second Chance Offer.
`);
    expect(draft.intelligence?.archetype).toBe("risk_free");
    expect(draft.title).toMatch(/Money back if/i);
    expect(draft.betStake).toBe(100);
    expect(draft.freeBetAmount).toBe(100);
    expect(draft.playbook?.refundIf).toBe(true);
    expect(draft.playbook?.steps.find((s) => s.kind === "qualify")?.detail).toMatch(
      /Underlay/
    );
    expect(draft.rules?.refundIf).toBe(true);
    expect(draft.expectedProfit).toBe(46.59);
  });

  it("detects golf from bet boost style paste", () => {
    const now = new Date(2026, 6, 9, 12, 0, 0);
    const draft = parseOfferFromText(
      `ON ANY GOLF THIS WEEKEND
BOOST YOUR SINGLE BY 18%
Valid until 11:00pm on Sunday 12th of July on any Golf single. Min odds 2.0. Max stake £25.
Token valid on Thursday 9th of July to Sunday 12th of July.
Bets placed with free bets do not qualify.`,
      now
    );
    expect(draft.category).toBe("golf");
    expect(draft.important.minOdds).toBe(2);
    expect(draft.important.maxStake).toBe(25);
    expect(draft.intelligence?.archetype).toBe("bet_boost");
    expect(draft.expectedProfit).toBeGreaterThan(3);
    expect(draft.expiresAt).toBeTruthy();
    const exp = new Date(draft.expiresAt!);
    expect(exp.getDate()).toBe(12);
    expect(exp.getMonth()).toBe(6);
    expect(exp.getHours()).toBe(23);
    expect(draft.important.importantNotes).toMatch(/Singles only/i);
    expect(draft.important.importantNotes).toMatch(/How to match:/i);
  });

  it("parses OCR typo 12t of July as expiry", () => {
    const now = new Date(2026, 6, 9, 12, 0, 0);
    const draft = parseOfferFromText(
      "Valid until 11:00pm on Sunday 12t of July on any Golf single.",
      now
    );
    expect(draft.expiresAt).toBeTruthy();
    const exp = new Date(draft.expiresAt!);
    expect(exp.getDate()).toBe(12);
    expect(exp.getMonth()).toBe(6);
    expect(exp.getHours()).toBe(23);
  });

  it("does not swallow CTA text into course name", () => {
    const draft = parseOfferFromText(
      "Get £10 back if 2nd or 3rd at Ascot today. Opt-in here. Min 5 runners."
    );
    expect(draft.scopeCourse).toBe("Ascot");
    expect(draft.scopeCourse).not.toMatch(/opt-in/i);
  });

  it("parses multi-course money-back paste as course scope", () => {
    const now = new Date(2026, 7, 1, 12, 0, 0);
    const draft = parseOfferFromText(
      `MONEY BACK AS A FREE BET if 2nd, 3rd or 4th on any Galway or Goodwood race on Saturday.
Min 8 runners. Max free bet £10. Expires 18:05 Saturday 1st August.`,
      now
    );
    expect(draft.category).toBe("horse_racing");
    expect(draft.scopeMode).toBe("course");
    expect(draft.scopeCourse).toBe("Galway, Goodwood");
    expect(draft.qualifyingPlaces).toEqual([2, 3, 4]);
  });

  it("parses QuinnBet 2nd to SP favourite paste", () => {
    const draft = parseOfferFromText(
      `QuinnBet HORSE RACING SPECIAL
2ND TO THE FAVOURITE Every UK/IRE Race, Every Day
Bet £10 get £10 FB if 2nd to SP favourite. Min 6 runners. Max £10 per day.`
    );
    expect(draft.category).toBe("horse_racing");
    expect(draft.bookmaker).toMatch(/Quinn/i);
    expect(draft.qualifyingPlaces).toEqual([2]);
    expect(draft.rules?.winnerMustBeSpFavourite).toBe(true);
    expect(draft.freeBetAmount).toBe(10);
  });

  it("parses Betfair extra-place paste with 16:45 Newmarket race time", () => {
    const now = new Date(2026, 6, 10, 12, 0, 0);
    const draft = parseOfferFromText(
      `16:45 NEWMARKET
PAYING 4 PLACES INSTEAD OF 3
Paying 4 Places instead of 3 in the 16:45 Newmarket. 1/5 odds on EW bets. Applies from 10am 08th July. If less than 11 runners take part, standard place terms will apply.`,
      now
    );
    expect(draft.category).toBe("horse_racing");
    expect(draft.scopeMode).toBe("race");
    expect(draft.scopeCourse).toBe("Newmarket");
    expect(draft.preferredOffTime).toBe("16:45");
    expect(draft.title).toBe("PAYING 4 PLACES INSTEAD OF 3");
    expect(draft.minRunners).toBe(11);
    expect(draft.intelligence?.archetype).toBe("extra_place");
    expect(draft.preferredOffTime).not.toBe("10:00");
  });

  it("reads £/€ dual-currency stakes and ignores T&C 'bet £10 get £10' examples", () => {
    const now = new Date(2026, 7, 2, 12, 0, 0);
    const draft = parseOfferFromText(
      `Galway\u202fBet\u202f£/€5\u202fGet\u202f£/€5

Get a\u202f£/€5\u202fFree Bet for\u202fany\u202fHorse\u202fracing\u202fmarket\u202fwhen you place a\u202f£/€5+ bet\u202fon\u202fany Galway Horse\u202fRacing\u202fmarket.

You can claim the offer once during the promotional period and your Free\u202fBet\u202fwill be credited to your account upon qualification\u202fand will remain\u202fvalid\u202funtil 23:59 on 02/08/26.

If my\u202fbet\u202fis over\u202f£/€5, will I qualify?Yes, however, you would only be eligible to receive a\u202f£/€5\u202fFree\u202fBet\u202fto use\u202fon any\u202fHorse\u202fracing\u202fmarket until 23:59 on 02/08/26.

What are the\u202fminimum\u202fodds for the qualifying\u202fbets?\u202fEach\u202fbet\u202fmust be a minimum of 1/4.

These Promotional Terms & Conditions apply to this Bet £/€5 Get a £/€5 Free Bet Promotion (the “Promotion”).
If a promotion is advertised in a different currency to an Eligible Player’s Website account, the qualifying spend and any bonus will be in that account currency (for example a promotion advertised as "bet £10 get £10" this will be "bet €10 get €10")
To participate in this Promotion an Eligible Player must opt in and place a £/€5+ bet on any Galway Horse Racing market at min odds of 1/4 during the Promotional Period (a “Qualifying Bet”).
Once an Eligible Player has placed a Qualifying Bet, they will automatically be credited with a £/€5 Free Bet on any Horse racing market.
www.ladbrokes.com`,
      now
    );
    expect(draft.bookmaker).toBe("Ladbrokes");
    expect(draft.category).toBe("horse_racing");
    expect(draft.betStake).toBe(5);
    expect(draft.freeBetAmount).toBe(5);
    expect(draft.title).toBe("Bet £5 get £5 free bet");
    expect(draft.qualifyingPlaces).toEqual([]);
    expect(draft.rules?.type).toBe("bet_get_free_place");
    expect(draft.rules?.qualifyingPlaces).toEqual([]);
    expect(draft.important.minOdds).toBe(1.25);
    expect(draft.scopeCourse).toMatch(/Galway/i);
    expect(draft.confidence).toBe("high");
  });

  it("parses plain Bet £5 Get £5 even when T&Cs contain a £10 example", () => {
    const draft = parseOfferFromText(
      `Coral
Bet £5 Get £5 free bet
Min odds 1/4.
(for example a promotion advertised as "bet £10 get £10" this will be "bet €10 get €10")`
    );
    expect(draft.betStake).toBe(5);
    expect(draft.freeBetAmount).toBe(5);
  });

  it("parses Betfair FREE £10 when you PLACE £10 multiples weekend window", () => {
    const now = new Date(2026, 7, 8, 12, 0, 0);
    const draft = parseOfferFromText(
      `FREE £10 BET WHEN YOU PLACE £10 WORTH OF MULTIPLES
ON THIS WEEKEND'S RACING
Betfair Sportsbook
Opt-in required. Bet £10 on Horse Racing multiples. Whole bet must have combined min odds of 2.0.
Applies to Horse Racing Multiples only from Saturday 8th August – Sunday 9th August.
Qualifying bet(s) must be placed after 7pm Friday 7th August.`,
      now
    );
    expect(draft.category).toBe("horse_racing");
    expect(draft.bookmaker).toBe("Betfair Sportsbook");
    expect(draft.betStake).toBe(10);
    expect(draft.freeBetAmount).toBe(10);
    expect(draft.title).toBe("Bet £10 get £10 free bet");
    expect(draft.qualifyingPlaces).toEqual([]);
    expect(draft.eventDate).toBeNull();
    expect(draft.startsOn).toBe("2026-08-07");
    expect(draft.important.minOdds).toBe(2);
    const exp = new Date(draft.expiresAt!);
    expect(exp.getFullYear()).toBe(2026);
    expect(exp.getMonth()).toBe(7);
    expect(exp.getDate()).toBe(9);
  });

  it("recovers stakes from noisy OCR fre/set wording", () => {
    const draft = parseOfferFromText(
      `You il gta fre bet of £10 whi
Maes betis £10
Optinrequed. Set £10 on Horse Racing mules on this Weekends Racing`
    );
    expect(draft.betStake).toBe(10);
    expect(draft.freeBetAmount).toBe(10);
    expect(draft.title).toBe("Bet £10 get £10 free bet");
    expect(draft.title).not.toMatch(/who can take part/i);
  });

  it("keeps 2nd–4th when How to match notes only mention 3rd or 4th", () => {
    const draft = parseOfferFromText(
      `Betfair Sportsbook
Bet £20 get £20 free bet (2nd, 3rd, 4th)
SNR free bet How to match: 1. Pick a runner in a suitable race (refund if 3rd or 4th).`
    );
    expect(draft.qualifyingPlaces).toEqual([2, 3, 4]);
    expect(draft.title).toMatch(/2nd/);
  });

  it("parses Dynobet deposit-gated UEFA Super Cup bet & get (O1 golden)", () => {
    const draft = parseOfferFromText(
      `DYNOBET
UEFA SUPER CUP BET & GET
PSG vs. Aston Villa
12/8/26

1. Deposit £30 or more using the promo code UEFA
2. Place qualifying bets worth £20 on any sports event
3. Receive a £10 Free Bet for the PSG vs. Aston Villa match on 12/8/26 only

Min odds 1.5. Free bet stake not returned. 1X wagering requirement on winnings from the free bet.
Max conversion £200. Valid 7 days. Skrill and Neteller excluded.
Valid until 12 August, 2026 at 23:59 GMT.
info@news.progressplay.com`,
      new Date("2026-08-10T12:00:00")
    );
    expect(draft.bookmaker).toBe("Dynobet");
    expect(draft.category).toBe("football");
    expect(draft.betStake).toBe(20);
    expect(draft.freeBetAmount).toBe(10);
    expect(draft.important.minOdds).toBe(1.5);
    expect(draft.important.promoCode).toBe("UEFA");
    expect(draft.important.minDeposit).toBe(30);
    expect(draft.important.depositRequired).toBe(true);
    expect(draft.important.rewardEventLabel).toMatch(/PSG/i);
    expect(draft.important.winningsWageringX).toBe(1);
    expect(draft.important.maxConversion).toBe(200);
    expect(draft.important.paymentExclusions).toEqual(
      expect.arrayContaining(["Skrill", "Neteller"])
    );
    expect(draft.playbook?.steps[0]?.kind).toBe("deposit");
    expect(draft.playbook?.steps[0]?.title).toMatch(/UEFA/);
    expect(draft.expiresAt).not.toBeNull();
    expect(draft.title).toBe("Bet £20 get £10 free bet (Football)");
  });

  it("parses Dynobet match-locked Hull vs Man Utd free bet without calling it football", () => {
    const draft = parseOfferFromText(
      `DYNOBET
Hull vs. Man Utd Bet & Get

1. Deposit at least £20 using the promo code MANUTD
2. Place bets worth £10 on any sports event
3. Receive a £10 Free Bet for the Hull City vs. Man Utd match on 22/8/26 only

The free bet can only be used on the Hull City vs. Man Utd match on 22/8/26.
Minimum odds 1.5. 1x wagering requirement on the winnings. Max conversion £200.
Valid until 22 August, 2026, 23:59 GMT. Opt-in required.`,
      new Date("2026-08-21T12:00:00")
    );
    expect(draft.bookmaker).toBe("Dynobet");
    expect(draft.category).toBe("general");
    expect(draft.betStake).toBe(10);
    expect(draft.freeBetAmount).toBe(10);
    expect(draft.important.promoCode).toBe("MANUTD");
    expect(draft.important.minOdds).toBe(1.5);
    expect(draft.important.rewardEventLabel).toMatch(/Hull/i);
    expect(draft.important.rewardEventLabel).toMatch(/Man Utd|Manchester/i);
    expect(draft.important.rewardEventDate).toBe("2026-08-22");
    expect(draft.important.winningsWageringX).toBe(1);
    expect(draft.important.maxConversion).toBe(200);
  });

  it("does not treat Dynobet 'up to 5 free bet' monthly cap as £5/£5 stakes", () => {
    const draft = parseOfferFromText(
      `Dynobet
UEFA Super Cup Bet & Get

Opt-in Required. Free bet is a one-time stake, can be used on the PSG Vs. Aston Villa on 12/8/26 only, minimum odds of 1.5, stake is not returned. 1X wagering the winnings. Max conversion: £200. Min deposit £30 with deposit code: UEFA required. Offer is valid until 12 August, 2026 23:59 GMT. Minimum of £20 worth of qualifying bets. Limited to 5 Freebet offers across the network, per month. Full Terms apply

UEFA Super Cup Bet & Get
Hi Samuel,
your bets can earn you a £10 Free Bet for the showdown.
Opt in with promo code UEFA, complete the qualifying steps and get your Free Bet ready for PSG vs. Aston Villa.
How to WIN:
Deposit £30 or more with code: UEFA
Place qualifying bets worth £20 on any sports event
Get a £10 Free Bet for the PSG Vs. Aston Villa on 12/8/26 only

Terms and Conditions:
Players must make a minimum deposit of £30 or more with code: UEFA, and place bets to the value of £20 or more on any sports event to get a £10 Free Bet to use specifically on the PSG Vs. Aston Villa only.
Any player can receive up to 5 (five) free bet bonus per month on their account.
The promotion is not available to customers depositing with Skrill and Neteller payment method.`,
      new Date("2026-08-10T12:00:00")
    );
    expect(draft.bookmaker).toBe("Dynobet");
    expect(draft.betStake).toBe(20);
    expect(draft.freeBetAmount).toBe(10);
    expect(draft.title).toBe("Bet £20 get £10 free bet (Football)");
    expect(draft.title).not.toMatch(/£5/);
    expect(draft.important.promoCode).toBe("UEFA");
    expect(draft.important.minDeposit).toBe(30);
    expect(draft.playbook?.steps[0]?.kind).toBe("deposit");
  });
});