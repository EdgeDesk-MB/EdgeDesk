import { Badge } from "@/components/ui/badge";
import type { AccountBalance } from "@/lib/services/balances.types";

/** Bookie / Exchange / Bank pill - shared by the Accounts table and any picker that lists accounts. */
export function AccountTypeBadge({ type }: { type: AccountBalance["type"] }) {
  return (
    <Badge
      variant={type === "bookie" ? "secondary" : type === "bank" ? "default" : "outline"}
      className="shrink-0 text-[11px] font-normal capitalize"
    >
      {type}
    </Badge>
  );
}
