import { cn } from "@/lib/utils";

export function EdgeDeskLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-[18px] shrink-0", className)}
      aria-hidden
    >
      {/* Geometric "E" mark — vertical spine + three horizontal arms */}
      <rect x="2" y="2" width="3.5" height="16" rx="1.75" />
      <rect x="2" y="2" width="15" height="3.5" rx="1.75" />
      <rect x="2" y="8.25" width="11" height="3.5" rx="1.75" />
      <rect x="2" y="14.5" width="15" height="3.5" rx="1.75" />
    </svg>
  );
}
