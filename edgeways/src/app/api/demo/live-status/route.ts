import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { accounts, db } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { listNeonDeskAccounts } from "@/lib/db/neon-desk-accounts";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/**
 * Live SQLite desk, not the public /demo fixture.
 * Used while the demo cookie is on so the bar can offer setup vs return.
 */
export const GET = withDeskScope(async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ started: false });
  }
  const rows = isNeonDesk()
    ? await listNeonDeskAccounts()
    : db.select({ type: accounts.type }).from(accounts).all();
  const started = rows.some((row) => row.type === "bank" || row.type === "bookie");
  return NextResponse.json({ started });
});
