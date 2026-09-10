import { Badge } from "@/components/ui/badge";
import type { AccountBalance } from "@/lib/services/balances.types";

/** Exchange / Bank pill. Bookies stay unbadged, the list is mostly bookies. */
export function AccountTypeBadge({ type }: { type: AccountBalance["type"] }) {
  if (type === "bookie") return null;
  return (
    <Badge
      variant={type === "bank" ? "default" : "outline"}
      className="shrink-0 text-[11px] font-normal capitalize"
    >
      {type}
    </Badge>
  );
}
