import { redirect } from "next/navigation";

/** Legacy path - Accounts is the bookie/exchange hub. */
export default function BalancesRedirectPage() {
  redirect("/accounts");
}
