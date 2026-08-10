import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { MessageSquarePlus } from "lucide-react";

export default function FeedbackPage() {
  return (
    <PageShell>
      <PageHeader
        title="Feedback"
        description="Report a bug, share an idea, or send a general note. Reports are saved on this device and can be emailed to the Edgeways inbox."
        icon={MessageSquarePlus}
      />

      <FeedbackForm />
    </PageShell>
  );
}
