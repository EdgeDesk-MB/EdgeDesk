import Link from "next/link";
import { pagePrimaryButtonProps, pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { LEGAL_PATHS } from "@/lib/legal/public";

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
            Guides cover day-to-day how-tos. Feedback is for bugs, ideas, and
            direct notes. Email is for account and billing, and we aim to reply
            within two working days.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild {...pagePrimaryButtonProps}>
            <Link href="/feedback">Send feedback</Link>
          </Button>
          <Button asChild variant="outline" {...pageSecondaryButtonProps}>
            <Link href="/help">Open guides</Link>
          </Button>
          <Button asChild variant="outline" {...pageSecondaryButtonProps}>
            <Link href={LEGAL_PATHS.contact}>Contact</Link>
          </Button>
          <Button asChild variant="outline" {...pageSecondaryButtonProps}>
            <Link href={LEGAL_PATHS.terms}>Terms</Link>
          </Button>
          <Button asChild variant="outline" {...pageSecondaryButtonProps}>
            <Link href={LEGAL_PATHS.privacy}>Privacy</Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
