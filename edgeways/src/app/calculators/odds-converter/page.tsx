"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PercentFlow } from "@/components/money-flow";
import { CalculatorShell } from "@/components/page-shell";
import {
  americanToDecimal,
  decimalToAmerican,
  decimalToFractional,
  fractionalToDecimal,
} from "@/lib/calc";

export default function OddsConverterPage() {
  const [decimal, setDecimal] = useState(3);
  const [fractionText, setFractionText] = useState("2/1");
  const [americanText, setAmericanText] = useState("200");

  function fromDecimal(value: number) {
    setDecimal(value);
    if (value > 1) {
      setFractionText(decimalToFractional(value));
      setAmericanText(String(decimalToAmerican(value)));
    }
  }

  function fromFraction(text: string) {
    setFractionText(text);
    const dec = fractionalToDecimal(text);
    if (dec) {
      setDecimal(Number(dec.toFixed(4)));
      setAmericanText(String(decimalToAmerican(dec)));
    }
  }

  function fromAmerican(text: string) {
    setAmericanText(text);
    const value = parseFloat(text);
    if (Number.isFinite(value) && value !== 0) {
      const dec = americanToDecimal(value);
      setDecimal(Number(dec.toFixed(4)));
      setFractionText(decimalToFractional(dec));
    }
  }

  const implied = decimal > 1 ? (1 / decimal) * 100 : 0;

  return (
    <CalculatorShell contentClassName="max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Odds Converter</h1>
        <p className="text-sm text-muted-foreground">
          Edit any format and the rest follow. Implied probability shows the bookie&apos;s margin baked in.
        </p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Convert</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Decimal</Label>
            <Input
              type="number"
              step={0.01}
              min={1.01}
              className="tabular-nums"
              value={decimal}
              onChange={(e) => fromDecimal(parseFloat(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Fractional</Label>
            <Input value={fractionText} onChange={(e) => fromFraction(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">American</Label>
            <Input
              value={americanText}
              className="tabular-nums"
              onChange={(e) => fromAmerican(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <div className="text-sm font-medium text-primary">Implied probability</div>
            <div className="text-xs text-muted-foreground">
              The chance the price says this outcome has - including the margin.
            </div>
          </div>
          <div className="text-3xl font-semibold">
            <PercentFlow value={implied} digits={2} />
          </div>
        </CardContent>
      </Card>
    </CalculatorShell>
  );
}
