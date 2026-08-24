import type { LucideIcon } from "lucide-react";
import { PageBody, PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";

export function AdminPage({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PageShell>
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        action={action}
      />
      <PageBody>{children}</PageBody>
    </PageShell>
  );
}
