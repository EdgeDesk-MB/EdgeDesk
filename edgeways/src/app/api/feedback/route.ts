import { NextResponse } from "next/server";
import { z } from "zod";
import { createFeedbackReport, listFeedbackReports } from "@/lib/services/feedback";
import { FEEDBACK_KINDS } from "@/lib/feedback/types";

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

export async function GET() {
  return NextResponse.json({ reports: listFeedbackReports(20) });
}

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const replyEmail =
    parsed.data.replyEmail && parsed.data.replyEmail.length > 0
      ? parsed.data.replyEmail
      : null;

  try {
    const report = createFeedbackReport({
      kind: parsed.data.kind,
      summary: parsed.data.summary,
      details: parsed.data.details,
      replyEmail,
      diagnostics: parsed.data.diagnostics,
    });
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
