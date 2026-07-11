import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";

export function EdgeDeskLogoIcon({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-2xl font-bold", className)}>
      <Icon icon="mdi:home" className="size-6" />
      EdgeDesk
    </span>
  );
}
