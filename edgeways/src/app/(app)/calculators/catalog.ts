/** In-page calculator cards. Every href must have a matching `page.tsx`. */

export type CalculatorCard = {
  href: string;
  title: string;
  description: string;
};

export type CalculatorSection = {
  id: string;
  title: string;
  description: string;
  calculators: CalculatorCard[];
};

export const CALCULATOR_SECTIONS: CalculatorSection[] = [
  {
    id: "core",
    title: "Core",
    description:
      "Everyday matched betting - back/lay, dutching and offer types. All push to the profit tracker.",
    calculators: [
      {
        href: "/calculators/matched",
        title: "Matched Betting",
        description: "Back/lay for qualifiers, free bets (SNR & SR) and risk-free offers.",
      },
      {
        href: "/calculators/dutching",
        title: "Dutching",
        description: "Split a stake across outcomes for equal profit - includes 2UP Dutch mode.",
      },
      {
        href: "/calculators/two-up",
        title: "Early Payout (2UP)",
        description: "Back a 2UP bookie, lay the exchange, and see the windfall scenarios.",
      },
      {
        href: "/calculators/ep-desk",
        title: "2UP Desk",
        description:
          "Model-driven 2UP/1UP desk with Dixon-Coles probabilities, Dutch vs lay ranking and live settlement.",
      },
      {
        href: "/calculators/accumulator",
        title: "Accumulator",
        description: "Doubles through Lucky 63 - layered lays on standard accas, full-cover returns.",
      },
      {
        href: "/calculators/each-way",
        title: "Each Way & Extra Place",
        description: "Lay win and place separately - standard each-way arbs and extra-place offers.",
      },
      {
        href: "/calculators/sequential-lay",
        title: "Sequential Lay",
        description: "Part lays at earlier odds, then finish at the current market - underlay or standard.",
      },
      {
        href: "/calculators/refund-if",
        title: "Refund-If",
        description: "Money-back-if-you-lose offers with free-bet or cash refund retention.",
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
    description: "Quick reference calculators - no tracker hand-off needed.",
    calculators: [
      {
        href: "/calculators/odds-converter",
        title: "Odds Converter",
        description: "Decimal ↔ fractional ↔ American ↔ implied probability.",
      },
      {
        href: "/calculators/ev",
        title: "EV & No-Vig",
        description: "Expected value, edge % and fair odds with the vig stripped out.",
      },
      {
        href: "/calculators/rule4",
        title: "Rule 4",
        description: "Effective odds and adjusted winnings after a Rule 4 deduction.",
      },
      {
        href: "/match-checker",
        title: "Match Checker",
        description: "Enter a back and lay price for a good/ok/poor verdict, lay stake and both outcomes.",
      },
    ],
  },
];

export const CALCULATOR_COMING_SOON = ["Asian handicap", "Exchange bonus lock-in"];

export function calculatorCardHrefs(): string[] {
  return CALCULATOR_SECTIONS.flatMap((section) =>
    section.calculators.map((calc) => calc.href)
  );
}
