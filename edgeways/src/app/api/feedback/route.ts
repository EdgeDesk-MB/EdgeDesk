import { NextResponse } from "next/server";
import { z } from "zod";
import { listFeedbackReports, submitFeedback } from "@/lib/services/feedback";
import { FEEDBACK_KINDS } from "@/lib/feedback/types";
import { getDeskActor, isDeskOwner } from "@/lib/db/desk-scope";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  summary: z.string().trim().min(1).max(160),
  details: z.string().trim().min(1).max(4000),
  replyEmail: z.union([z.string().trim().email().max(200), z.literal(""), z.null()]).optional(),
  diagnostics: z.object({
    appVersion: z.string().max(40),
    userAgent: z.string().max(500),
    href: z.string().max(500),
    timezone: z.string().max(80),
  }),
});

export const GET = withDeskScope(async function GET() {
  if (!isDeskOwner(getDeskActor())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ reports: await listFeedbackReports(20) });
});

export const POST = withDeskScope(async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const replyEmail =
    parsed.data.replyEmail && parsed.data.replyEmail.length > 0
      ? parsed.data.replyEmail
      : null;

  try {
    const result = await submitFeedback({
      kind: parsed.data.kind,
      summary: parsed.data.summary,
      details: parsed.data.details,
      replyEmail,
      diagnostics: parsed.data.diagnostics,
      signedInEmail: getDeskActor().email,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
