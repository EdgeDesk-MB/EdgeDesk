import { sectionDescription, sectionTitle } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * Page-level admin section: title, optional description, then content with a
 * consistent gap. Every admin page section uses this so vertical rhythm never
 * drifts between pages.
 */
export function AdminSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className={sectionTitle}>{title}</h2>
      {description ? (
        <p className={cn(sectionDescription, "mt-1")}>{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
