import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureVenueAccount } from "@/lib/accounts/ensure-venue";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { ensureNeonVenueAccount } from "@/lib/db/neon-desk-ensure-venue";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { denyPublicDemoWrite } from "@/lib/demo/public-demo-guard";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1),
  kind: z.enum(["bookie", "exchange"]),
});

/** Idempotent: create/reactivate a bookie or exchange wallet from a free-typed name. */
export const POST = withDeskScope(async function POST(req: NextRequest) {
  const demoBlock = await denyPublicDemoWrite();
  if (demoBlock) return demoBlock;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    if (isNeonDesk()) {
      const result = await ensureNeonVenueAccount(parsed.data.name, parsed.data.kind);
      return NextResponse.json(result);
    }
    const result = ensureVenueAccount(parsed.data.name, parsed.data.kind);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.startsWith("Sign in") ? 401 : 400;
    return NextResponse.json({ error: status === 401 ? message : String(e) }, { status });
  }
});
