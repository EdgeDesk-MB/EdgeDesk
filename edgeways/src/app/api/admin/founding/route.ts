import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/session";
import { grantFoundingInvite } from "@/lib/services/waitlist";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().min(3).max(200),
});

export async function POST(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  try {
    const result = await grantFoundingInvite(parsed.data.email);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not add that email.";
    if (message.includes("valid email")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[admin/founding] grant failed:", error);
    return NextResponse.json(
      { error: "Could not add that email. Please try again." },
      { status: 500 }
    );
  }
}
