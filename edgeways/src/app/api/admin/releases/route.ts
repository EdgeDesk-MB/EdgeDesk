import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/session";
import { setPosthogFlagActive } from "@/lib/admin/flags";
import {
  writeAppUpdateSettings,
  writeMaintenanceBanner,
} from "@/lib/admin/operator-settings";
import { isAppUpdateMode } from "@/lib/admin/app-update-shared";
import {
  isInvalidBannerHrefInput,
  isSiteBannerKind,
} from "@/lib/admin/maintenance-banner-shared";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: {
    banner?: {
      enabled?: boolean;
      message?: string;
      kind?: string;
      href?: string | null;
      linkLabel?: string | null;
    };
    update?: {
      mode?: string;
      message?: string;
    };
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
    if (body.banner.kind != null && !isSiteBannerKind(body.banner.kind)) {
      return NextResponse.json(
        { error: "Pick maintenance, notice, or offer." },
        { status: 400 }
      );
    }
    if (
      body.banner.href != null &&
      typeof body.banner.href !== "string"
    ) {
      return NextResponse.json(
        { error: "Banner link must be text." },
        { status: 400 }
      );
    }
    if (isInvalidBannerHrefInput(body.banner.href)) {
      return NextResponse.json(
        {
          error:
            "Enter a valid http(s) link, or a path starting with /, or clear the field.",
        },
        { status: 400 }
      );
    }
    if (
      body.banner.linkLabel != null &&
      typeof body.banner.linkLabel !== "string"
    ) {
      return NextResponse.json(
        { error: "Link label must be text." },
        { status: 400 }
      );
    }
    const banner = await writeMaintenanceBanner({
      enabled: Boolean(body.banner.enabled),
      message: message ?? "",
      kind: isSiteBannerKind(body.banner.kind)
        ? body.banner.kind
        : undefined,
      href: body.banner.href ?? null,
      linkLabel: body.banner.linkLabel ?? null,
    });
    return NextResponse.json({ banner });
  }

  if (body.update) {
    if (body.update.mode != null && !isAppUpdateMode(body.update.mode)) {
      return NextResponse.json(
        { error: "Pick auto, off, or force." },
        { status: 400 }
      );
    }
    if (body.update.message != null && typeof body.update.message !== "string") {
      return NextResponse.json(
        { error: "Update message must be text." },
        { status: 400 }
      );
    }
    const update = await writeAppUpdateSettings({
      mode: isAppUpdateMode(body.update.mode) ? body.update.mode : undefined,
      message: body.update.message ?? "",
    });
    return NextResponse.json({ update });
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
