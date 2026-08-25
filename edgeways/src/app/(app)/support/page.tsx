import { redirect } from "next/navigation";

/** Support merged into Guides (/help) — keep the old URL landing somewhere useful. */
export default function SupportPage() {
  redirect("/help");
}
