import type { ReactNode } from "react";
import { warningNotice } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * In-page execution warning. Same plate as Acca / Bet Builder offer
 * requirements: warning title, muted body, 12px type.
 */
export function WarningNotice({
  title,
  children,
  className,
  action,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        warningNotice,
        className
      )}
      role="status"
    >
      <p className="font-semibold text-warning">{title}</p>
      <div className="mt-0.5 text-muted-foreground">{children}</div>
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}
