import { NextResponse } from "next/server";
import { z } from "zod";
import { joinWaitlist } from "@/lib/services/waitlist";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().min(3).max(200),
});

export const POST = withDeskScope(async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  try {
    const result = await joinWaitlist(parsed.data.email);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not join the waitlist.";
    if (message.includes("valid email")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[waitlist] join failed:", e);
    return NextResponse.json(
      { error: "Could not join the waitlist. Please try again." },
      { status: 500 }
    );
  }
});
