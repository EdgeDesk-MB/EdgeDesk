import Link from "next/link";
import { pagePrimaryButtonProps, pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export default function SupportPage() {
  return (
    <PageShell>
      <PageHeader
        title="Support"
        description="Get help with Edgeways. More channels will land here."
        icon={MessageCircle}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">While this page fills out</CardTitle>
          <CardDescription>
            Guides cover day-to-day how-tos. Feedback is for bugs, ideas, and direct notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild {...pagePrimaryButtonProps}>
            <Link href="/feedback">Send feedback</Link>
          </Button>
          <Button asChild variant="outline" {...pageSecondaryButtonProps}>
            <Link href="/help">Open guides</Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
