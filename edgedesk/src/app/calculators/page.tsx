import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { Calculator } from "lucide-react";

const sections = [
  {
    id: "core",
    title: "Core",
    description: "Everyday matched betting - back/lay, dutching and offer types. All push to the profit tracker.",
    calculators: [
      {
        href: "/calculators/matched",
        title: "Matched Betting",
        description: "Back/lay for qualifiers, free bets (SNR & SR) and risk-free offers.",
      },
      {
        href: "/calculators/dutching",
        title: "Dutching",
        description: "Split a stake across outcomes for equal profit - includes 2UP dutch mode.",
      },
      {
        href: "/calculators/two-up",
        title: "Early Payout (2UP)",
        description: "Back a 2UP bookie, lay the exchange, and see the windfall scenarios.",
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
        description: "Decimal ↔ fractional ↔ american ↔ implied probability.",
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
    ],
  },
];

const phase2 = [
  "Arbitrage",
  "Kelly criterion",
  "Asian handicap",
  "Exchange bonus lock-in",
];

export default function CalculatorsPage() {
  return (
    <PageShell className="gap-[calc(var(--layout-stack-gap)*2)]">
      <PageHeader
        helpId="calculators"
        icon={Calculator}
        title="Calculators"
        description="The matched betting toolkit. Core calculators open the profit tracker with your numbers pre-filled - review, link an event, and save."
      />

      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{section.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.calculators.map((calc) => (
              <Link key={calc.href} href={calc.href}>
                <Card className="h-full transition-colors hover:border-primary/50 hover:bg-primary/[0.02]">
                  <CardHeader>
                    <CardTitle className="text-base">{calc.title}</CardTitle>
                    <CardDescription>{calc.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Coming soon</p>
        <div className="flex flex-wrap gap-1.5">
          {phase2.map((name) => (
            <Badge key={name} variant="outline" className="font-normal text-muted-foreground">
              {name}
            </Badge>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
