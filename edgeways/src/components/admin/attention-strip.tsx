import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AttentionItem } from "@/lib/admin/attention";
import { sectionTitle, surfaceLift } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const VALUE_TONE: Record<AttentionItem["tone"], string> = {
  warning: "text-warning",
  destructive: "text-destructive",
};

export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Needs attention">
      <h2 className={sectionTitle}>Needs attention</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              surfaceLift,
              "group flex flex-col rounded-lg border border-transparent px-4 py-4 text-left transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page"
            )}
          >
            <p className="h-3.5 text-[11px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <div
              className={cn(
                "mt-0.5 flex h-7 items-center text-2xl font-bold leading-none tabular-nums tracking-tight",
                VALUE_TONE[item.tone]
              )}
            >
              {item.value}
            </div>
            <p className="mt-2.5 flex h-3.5 items-center gap-1 text-[11px] leading-none text-muted-foreground">
              <span className="truncate">{item.sub}</span>
              <ArrowRight className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
