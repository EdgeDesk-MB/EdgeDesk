import Link from "next/link";
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
            Guides cover day-to-day how-tos. Contact us is for direct messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/help">Open guides</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contact">Contact us</Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
