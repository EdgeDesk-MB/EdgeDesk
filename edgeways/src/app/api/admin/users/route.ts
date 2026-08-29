import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/session";
import { listAppUsers, setAppUserRole } from "@/lib/services/app-users";
import type { AppUserRole } from "@/lib/admin/emails";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const users = await listAppUsers();
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: { clerkUserId?: string; role?: string };
  try {
    body = (await request.json()) as { clerkUserId?: string; role?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const clerkUserId = body.clerkUserId?.trim();
  const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;
  if (!clerkUserId || !role) {
    return NextResponse.json({ error: "clerkUserId and role are required." }, { status: 400 });
  }

  try {
    const user = await setAppUserRole({
      clerkUserId,
      role: role as AppUserRole,
    });
    return NextResponse.json({ user });
  } catch (error) {
    const code = error instanceof Error ? error.message : "error";
    if (code === "not-found") {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (code === "owner") {
      return NextResponse.json(
        { error: "The owner cannot be demoted." },
        { status: 400 }
      );
    }
    if (code === "bootstrap") {
      return NextResponse.json(
        { error: "The bootstrap admin cannot be demoted." },
        { status: 400 }
      );
    }
    if (code === "last-admin") {
      return NextResponse.json(
        { error: "You cannot revoke the last remaining admin." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Could not update the role." }, { status: 500 });
  }
}
