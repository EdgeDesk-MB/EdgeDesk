/** In-page calculator cards. Every href must have a matching `page.tsx`. */

import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  ChartPie,
  Layers,
  ListOrdered,
  Medal,
  Percent,
  Repeat,
  Scale,
  Scissors,
  Timer,
  Undo2,
} from "lucide-react";
import { FootballIcon } from "@/components/sport-icon";

/** Lucide or a stroke-matched custom mark (FootballIcon for 2UP Desk). Same API as nav icons. */
export type CalculatorIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
  size?: number;
}>;

export type CalculatorCard = {
  href: string;
  title: string;
  description: string;
  /** Leading mark: same recipe as welcome Get started tiles. */
  icon: CalculatorIcon;
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
      "Everyday matched betting. All save to the tracker.",
    calculators: [
      {
        href: "/calculators/matched",
        title: "Matched Betting",
        description: "Qualifiers, free bets and money-back offers.",
        icon: ArrowLeftRight,
      },
      {
        href: "/calculators/dutching",
        title: "Dutching",
        description: "Split a stake across outcomes for equal profit.",
        icon: ChartPie,
      },
      {
        href: "/calculators/two-up",
        title: "Early Payout (2UP)",
        description: "Back a 2UP bookie and lay the exchange.",
        icon: Timer,
      },
      {
        href: "/calculators/ep-desk",
        title: "2UP Desk",
        description: "Dixon-Coles 2UP desk with dutch versus lay ranking.",
        icon: FootballIcon,
      },
      {
        href: "/calculators/accumulator",
        title: "Accumulator",
        description: "Doubles through Lucky 63 and full-cover returns.",
        icon: Layers,
      },
      {
        href: "/calculators/each-way",
        title: "Each Way & Extra Place",
        description: "Lay win and place separately, including extra places.",
        icon: Medal,
      },
      {
        href: "/calculators/sequential-lay",
        title: "Sequential Lay",
        description: "Part lays, then finish at the current market.",
        icon: ListOrdered,
      },
      {
        href: "/calculators/refund-if",
        title: "Refund-If",
        description: "Money-back-if-you-lose, cash or free bet.",
        icon: Undo2,
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
    description: "Quick reference with no tracker hand-off.",
    calculators: [
      {
        href: "/calculators/odds-converter",
        title: "Odds Converter",
        description: "Decimal ↔ fractional ↔ American ↔ implied probability.",
        icon: Repeat,
      },
      {
        href: "/calculators/ev",
        title: "EV & No-Vig",
        description: "Expected value, edge and fair odds with vig stripped.",
        icon: Percent,
      },
      {
        href: "/calculators/rule4",
        title: "Rule 4",
        description: "Odds and returns after a Rule 4 deduction.",
        icon: Scissors,
      },
      {
        href: "/match-checker",
        title: "Match Checker",
        description: "Back and lay for a verdict, lay stake and both outcomes.",
        icon: Scale,
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
