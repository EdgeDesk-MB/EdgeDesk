import {
  sectionDescription,
  sectionNestedTitle,
  sectionTitle,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * Page-level admin section: title, optional description, then content with a
 * consistent gap. Every admin page section uses this so vertical rhythm never
 * drifts between pages.
 */
export function AdminSection({
  title,
  description,
  action,
  headingLevel = 2,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  headingLevel?: 2 | 3;
  children: React.ReactNode;
  className?: string;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section className={className}>
      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Heading
            className={headingLevel === 3 ? sectionNestedTitle : sectionTitle}
          >
            {title}
          </Heading>
          {description ? (
            <p className={cn(sectionDescription, "mt-1")}>{description}</p>
          ) : null}
        </div>
        {action ? (
          <div className="w-full md:w-auto md:shrink-0 md:pt-0.5">{action}</div>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
