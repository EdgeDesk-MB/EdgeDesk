import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/session";
import { setPosthogFlagActive } from "@/lib/admin/flags";
import { writeMaintenanceBanner } from "@/lib/admin/operator-settings";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: {
    banner?: { enabled?: boolean; message?: string };
    flag?: { id?: number; active?: boolean };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.banner) {
    const message = body.banner.message;
    if (message != null && typeof message !== "string") {
      return NextResponse.json(
        { error: "Banner message must be text." },
        { status: 400 }
      );
    }
    const banner = await writeMaintenanceBanner({
      enabled: Boolean(body.banner.enabled),
      message: message ?? "",
    });
    return NextResponse.json({ banner });
  }

  const flagId = body.flag?.id;
  if (body.flag && typeof flagId === "number" && Number.isInteger(flagId)) {
    const result = await setPosthogFlagActive(flagId, Boolean(body.flag.active));
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json({ message: result.message });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}
