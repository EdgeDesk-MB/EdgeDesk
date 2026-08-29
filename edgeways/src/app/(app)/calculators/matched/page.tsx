"use client";

import { CalculatorPageHeader } from "@/components/layout/calculator-page-header";
import { MatchedCalculator } from "@/components/calc/matched-calculator";
import { CalculatorShell } from "@/components/page-shell";

export default function MatchedCalculatorPage() {
  return (
    <CalculatorShell>
      <CalculatorPageHeader
        title="Matched Betting"
        description="Lay stake and locked-in profit for a back and lay."
      />
      <MatchedCalculator />
    </CalculatorShell>
  );
}
