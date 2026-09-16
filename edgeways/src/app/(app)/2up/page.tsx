import { permanentRedirect } from "next/navigation";
import { TWOUP_DESK_PATH } from "@/lib/calc/ep/fixture-query";

/** Bookmarks and old nav still hit `/2up`. The desk lives at `/early-payout`. */
export default async function TwoUpDeskLegacyRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) q.set(key, value);
    else if (Array.isArray(value) && value[0]) q.set(key, value[0]);
  }
  const qs = q.toString();
  permanentRedirect(qs ? `${TWOUP_DESK_PATH}?${qs}` : TWOUP_DESK_PATH);
}
