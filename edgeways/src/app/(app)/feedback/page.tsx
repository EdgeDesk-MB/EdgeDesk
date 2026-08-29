import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { MessageSquarePlus } from "lucide-react";

export default function FeedbackPage() {
  return (
    <PageShell>
      <PageHeader
        title="Feedback"
        description="Report a bug or share an idea."
        icon={MessageSquarePlus}
      />

      <FeedbackForm />
    </PageShell>
  );
}
