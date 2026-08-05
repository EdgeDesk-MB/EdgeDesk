import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function ContactPage() {
  return (
    <PageShell>
      <PageHeader
        title="Contact us"
        description="Reach the Edgeways team. A proper form will replace this stub."
        icon={Mail}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coming soon</CardTitle>
          <CardDescription>
            For now, use Support or Guides from the top bar. Contact channels
            (email / form) will land here without changing the nav structure.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder page so the desktop sub-nav can ship the right information
          architecture first.
        </CardContent>
      </Card>
    </PageShell>
  );
}
