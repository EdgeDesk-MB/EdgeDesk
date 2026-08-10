import type { OfferIntelligenceSignals } from "./types";

function parseMoney(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Pull structured signals from raw promo / T&C text. */
export function extractOfferSignals(text: string): OfferIntelligenceSignals {
  const boostPercent =
    parseBoostPercent(text) ??
    parseMoney(
      text.match(/\b(\d+(?:\.\d+)?)\s*%\s*(?:winnings?\s+)?boost\b/i)?.[1] ?? ""
    );

  const singlesOnly =
    /\bsingles?\s+only\b/i.test(text) ||
    /\b(?:on\s+)?any\s+\w+\s+single\b/i.test(text) ||
    /\bvalid\s+on\s+(?:any\s+)?\w+\s+singles?\b/i.test(text);

  const multisOnly =
    /\baccas?\s+only\b/i.test(text) ||
    /\baccumulator\s+only\b/i.test(text) ||
    /\bmultiples?\s+only\b/i.test(text);

  const betBuilderMention =
    /\bbet\s*builders?\b/i.test(text) || /\bbuild\s+a\s+bet\b/i.test(text);

  const accaMention =
    /\bacca\b/i.test(text) ||
    /\baccumulator\b/i.test(text) ||
    /\baccas?\b/i.test(text);

  const accaOrBetBuilder =
    /\baccas?\s*(?:\/|or|&)\s*bet\s*builders?\b/i.test(text) ||
    /\bbet\s*builders?\s*(?:\/|or|&)\s*accas?\b/i.test(text) ||
    /\bon\s+accas?\s+or\s+bet\s*builders?\b/i.test(text) ||
    /\bon\s+(?:an?\s+)?acca\s+or\s+bet\s*builder\b/i.test(text);

  const rewardAcca =
    /\bfree\s*bets?\s+must\s+be\s+(?:used\s+)?(?:on|as)\s+(?:an?\s+)?(?:acca|accumulator|multi)/i.test(
      text
    ) ||
    /\bfree\s*bets?\s+(?:valid\s+on|on)\s+(?:an?\s+)?(?:acca|accumulator|multi)/i.test(text) ||
    /\buse\s+(?:the\s+)?free\s*bet\s+on\s+(?:an?\s+)?(?:acca|accumulator|multi)/i.test(text) ||
    /\breward\s+(?:must\s+be|valid\s+on)\s+(?:an?\s+)?(?:acca|accumulator)/i.test(text);

  const rewardBetBuilder =
    /\bfree\s*bets?\s+must\s+be\s+(?:used\s+)?(?:on|as)\s+(?:an?\s+)?bet\s*builder/i.test(
      text
    ) ||
    /\bfree\s*bets?\s+(?:valid\s+on|on)\s+(?:an?\s+)?bet\s*builder/i.test(text) ||
    /\buse\s+(?:the\s+)?free\s*bet\s+on\s+(?:an?\s+)?bet\s*builder/i.test(text);

  const rewardAccaOrBetBuilder =
    /\bfree\s*bets?\s+(?:token\s+)?(?:to\s+be\s+used|must\s+be\s+(?:used\s+)?|valid)\s+on\s+(?:bet\s*builder\/acca|acca\/bet\s*builder|accas?\s+or\s+bet\s*builders?|bet\s*builders?\s+or\s+accas?)/i.test(
      text
    ) ||
    /\bbet\s*builder\/acca\s+markets?\s+only/i.test(text) ||
    /\bon\s+(?:an?\s+)?acca,?\s+bet\s*builder\s+or\s+any\s+multiple/i.test(text) ||
    /\bfree\s*bet\s+token\s+to\s+be\s+used\s+on\s+bet\s*builder\/acca/i.test(text);

  const minSel =
    text.match(/\bmin(?:imum)?(?:\s+of)?\s+(\d+)\s+(?:legs?|selections?|fold)\b/i) ??
    text.match(/\b(\d+)\s+(?:legs?|selections?|fold)\s+or\s+more\b/i);

  return {
    boostPercent,
    boostOnWinnings:
      boostPercent != null &&
      (/\bwinnings?\s+boost\b/i.test(text) ||
        /\bbet\s+boost\b/i.test(text) ||
        /\bboost\s+(?:your|the)\s+(?:single|bet)\b/i.test(text) ||
        /\b\d+\s*%\s+boost\b/i.test(text)),
    singlesOnly,
    multisOnly,
    accaMention,
    betBuilderMention,
    accaOrBetBuilder,
    rewardAcca,
    rewardBetBuilder,
    rewardAccaOrBetBuilder,
    inPlayAllowed:
      /\bin[- ]?play\s+(?:and\s+pre[- ]?play|or\s+pre[- ]?play|bets?\s+allowed)\b/i.test(
        text
      ) || /\bpre[- ]?play\s+or\s+in[- ]?play\b/i.test(text),
    tokenSingleUse:
      /\bone\s+bet\s+only\b/i.test(text) ||
      /\bvalid\s+for\s+one\s+bet\b/i.test(text) ||
      /\bsingle\s+use\b/i.test(text) ||
      /\bone\s+token\b/i.test(text),
    cashOutVoids:
      /\bcash(?:ed)?\s+out\b/i.test(text) &&
      /\b(?:not\s+qualify|void|ineligible|do\s+not\s+qualify)\b/i.test(text),
    noFreeBetsWithOffer:
      /\bfree\s*bets?\s+(?:do\s+not|don't|cannot|can't)\s+qualify\b/i.test(text) ||
      /\bnot\s+(?:valid|eligible)\s+(?:with|on)\s+free\s*bets?\b/i.test(text),
    sportsbookOnly: /\bsportsbook\s+(?:exclusive|only)\b/i.test(text),
    snrFreeBet:
      /\bsnr\b/i.test(text) ||
      /\bstake\s+not\s+returned\b/i.test(text) ||
      (!/\bstake\s+returned\b/i.test(text) &&
        /\bfree\s*bet\b/i.test(text) &&
        !/\bstake\s+returned\s+free\s*bet\b/i.test(text)),
    newCustomersOnly: /\bnew\s+customers?\s+only\b/i.test(text),
    minSelections: minSel?.[1] ? parseInt(minSel[1], 10) : null,
  };
}

function parseBoostPercent(text: string): number | null {
  const patterns = [
    /\bboost(?:ed)?\s+(?:your\s+)?(?:single|bet)\s+by\s+(\d+(?:\.\d+)?)\s*%/i,
    /\b(\d+(?:\.\d+)?)\s*%\s*(?:winnings?\s+)?boost\b/i,
    /\b(\d+(?:\.\d+)?)\s*%\s+boost\s+on\s+winnings\b/i,
    /\benhance[sd]?\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%/i,
    /\b(\d+(?:\.\d+)?)\s*%\s+(?:odds\s+)?boost\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n > 0 && n <= 500) return n;
    }
  }
  return null;
}
