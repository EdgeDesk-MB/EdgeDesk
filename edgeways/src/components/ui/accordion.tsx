import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export default function Accordion({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="group">
      <summary
        className={cn(
          "cursor-pointer select-none rounded-md p-3 text-base font-medium",
          "bg-muted hover:bg-muted/70"
        )}
      >
        {title}
        <ChevronDown
          className={cn(
            "float-right size-4 transition-transform duration-200",
            "group-open:rotate-180",
            "text-muted-foreground"
          )}
          aria-hidden
        />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
