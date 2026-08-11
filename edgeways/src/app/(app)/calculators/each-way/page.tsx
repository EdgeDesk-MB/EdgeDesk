"use client";

import { EachWayCalculatorForm } from "@/components/calc/each-way-calculator-form";
import { CalculatorShell } from "@/components/page-shell";

export default function EachWayCalculatorPage() {
  return (
    <CalculatorShell>
      <EachWayCalculatorForm />
    </CalculatorShell>
  );
}
