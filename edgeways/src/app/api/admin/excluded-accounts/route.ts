import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/session";
import {
  readExcludedAccountIds,
  writeExcludedAccountIds,
} from "@/lib/admin/exclude-accounts-server";
import { uniqueClerkUserIds, MAX_EXCLUDED_ACCOUNTS } from "@/lib/admin/exclude-accounts";
import { listAppUsers } from "@/lib/services/app-users";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const clerkUserIds = await readExcludedAccountIds();
  return NextResponse.json({ clerkUserIds });
}

export async function PATCH(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: { clerkUserId?: string; excluded?: boolean };
  try {
    body = (await request.json()) as { clerkUserId?: string; excluded?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const clerkUserId = uniqueClerkUserIds([body.clerkUserId ?? ""])[0];
  if (!clerkUserId || typeof body.excluded !== "boolean") {
    return NextResponse.json(
      { error: "clerkUserId and excluded are required." },
      { status: 400 }
    );
  }

  if (body.excluded) {
    const users = await listAppUsers();
    if (!users.some((user) => user.clerkUserId === clerkUserId)) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
  }

  const current = await readExcludedAccountIds();
  if (
    body.excluded &&
    !current.includes(clerkUserId) &&
    current.length >= MAX_EXCLUDED_ACCOUNTS
  ) {
    return NextResponse.json(
      { error: `You can exclude at most ${MAX_EXCLUDED_ACCOUNTS} accounts.` },
      { status: 400 }
    );
  }
  const next = new Set(current);
  if (body.excluded) next.add(clerkUserId);
  else next.delete(clerkUserId);
  const clerkUserIds = await writeExcludedAccountIds(next);
  return NextResponse.json({ clerkUserIds });
}
