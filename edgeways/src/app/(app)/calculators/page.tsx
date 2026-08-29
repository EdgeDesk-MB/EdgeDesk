import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { Calculator } from "lucide-react";
import { offerCampaignCardInteractive, sectionDescription, sectionTitle } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { CALCULATOR_COMING_SOON, CALCULATOR_SECTIONS } from "./catalog";

export default function CalculatorsPage() {
  return (
    <PageShell className="gap-[calc(var(--layout-stack-gap)*2)]">
      <PageHeader
        helpId="calculators"
        icon={Calculator}
        title="Calculators"
        description="Work out a lay, then save it to the tracker."
      />

      {CALCULATOR_SECTIONS.map((section) => (
        <section key={section.id} className="flex flex-col gap-6">
          <div className="space-y-2">
            <h2 className={sectionTitle}>{section.title}</h2>
            <p className={sectionDescription}>{section.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.calculators.map((calc) => {
              const Icon = calc.icon;
              return (
                <Link
                  key={calc.href}
                  href={calc.href}
                  className="block h-full min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page"
                >
                  <Card className={cn("h-full", offerCampaignCardInteractive)}>
                    <CardHeader className="gap-2">
                      <Icon
                        className="size-6 shrink-0 text-primary-text"
                        size={24}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-pretty break-words text-base">
                          {calc.title}
                        </CardTitle>
                        <CardDescription className="text-pretty break-words">
                          {calc.description}
                        </CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Coming soon</p>
        <div className="flex flex-wrap gap-1.5">
          {CALCULATOR_COMING_SOON.map((name) => (
            <Badge key={name} variant="outline" className="font-normal text-muted-foreground">
              {name}
            </Badge>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
