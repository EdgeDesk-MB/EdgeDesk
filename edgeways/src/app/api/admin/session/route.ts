import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const { admin } = await readAdminSession();
  return NextResponse.json({ admin });
}
