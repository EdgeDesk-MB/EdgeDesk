/**
 * Shared landing FAQ. Waitlist and launch homes both need the positioning
 * answers so we never imply we send bookie offers (EDGE-64).
 */

export const HERO_LEAD =
  "Edgeways is the matched betting command centre. One desk for the day. No more faff.";

export const HERO_SHARE_LINE = "One desk for the day. No more faff.";

export const HOW_IT_HELPS_LEAD =
  "Matchers help you find bets. Edgeways helps you run them, then shows what paid. We supplement finders, we do not replace them. We do not send bookie offers. Less tab-hopping. Fewer missed steps.";

export const POSITIONING_FAQ = [
  {
    q: "What is Edgeways?",
    a: "A matched betting command centre. What to do next, clean execution, and what you kept.",
  },
  {
    q: "Is this an oddsmatcher?",
    a: "No. Matchers help you find bets. Edgeways runs the day and shows what you kept.",
  },
  {
    q: "Do you send me bookie offers?",
    a: "No. We organise offers you already have. Use a finder such as Oddsmonkey or Outplayed, or your own research. Edgeways runs the day.",
  },
  {
    q: "I'm new to matched betting. Is this for me?",
    a: "You can use the calculators. The desk is built for people already matching bets who have outgrown spreadsheets. You still need your own source of offers.",
  },
] as const;
