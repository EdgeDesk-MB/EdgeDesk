import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { MessageSquarePlus } from "lucide-react";

export default function FeedbackPage() {
  return (
    <PageShell>
      <PageHeader
        title="Feedback"
        description="Report a bug, share an idea, or send a general note. We'll review every report."
        icon={MessageSquarePlus}
      />

      <FeedbackForm />
    </PageShell>
  );
}
