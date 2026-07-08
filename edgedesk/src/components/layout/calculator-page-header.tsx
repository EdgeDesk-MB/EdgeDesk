import { DeskPageHeader } from "@/components/layout/desk-page-header";
import type { PageHelpId } from "@/content/help/page-help";

export function CalculatorPageHeader({
  title,
  description,
  helpId,
}: {
  title: string;
  description?: React.ReactNode;
  helpId?: PageHelpId;
}) {
  return (
    <DeskPageHeader
      title={title}
      description={description}
      helpId={helpId}
      meta
      bordered={false}
    />
  );
}
