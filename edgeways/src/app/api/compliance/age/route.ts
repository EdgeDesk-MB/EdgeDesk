import { NextResponse } from "next/server";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { patchNeonDeskSettings } from "@/lib/db/neon-desk-settings";
import { withDeskScope } from "@/lib/db/with-desk-scope";

/**
 * Persist 18+ confirmation. Hosted path never opens SQLite.
 */
export const POST = withDeskScope(async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = body.ageConfirmedAt;
  const ageConfirmedAt =
    typeof raw === "number" && Number.isFinite(raw) && raw > 0
      ? Math.trunc(raw)
      : Date.now();

  if (isNeonDesk()) {
    try {
      const settings = await patchNeonDeskSettings({ ageConfirmedAt });
      return NextResponse.json({ ageConfirmedAt: settings.ageConfirmedAt });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save confirmation.";
      if (message.includes("Sign in")) {
        return NextResponse.json({ error: message }, { status: 401 });
      }
      throw err;
    }
  }

  const { patchAppSettings } = await import("@/lib/services/settings");
  const settings = patchAppSettings({ ageConfirmedAt });
  return NextResponse.json({ ageConfirmedAt: settings.ageConfirmedAt });
});
