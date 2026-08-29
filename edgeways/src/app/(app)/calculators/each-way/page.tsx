"use client";

import { EachWayCalculatorForm } from "@/components/calc/each-way-calculator-form";
import { CalculatorPageHeader } from "@/components/layout/calculator-page-header";
import { CalculatorShell } from "@/components/page-shell";

export default function EachWayCalculatorPage() {
  return (
    <CalculatorShell>
      <CalculatorPageHeader
        title="Each Way & Extra Place"
        description="Lay win and place separately, including extra-place offers."
      />
      <EachWayCalculatorForm embedded />
    </CalculatorShell>
  );
}
