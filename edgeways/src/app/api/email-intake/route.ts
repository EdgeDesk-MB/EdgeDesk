import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getEmailIntakeStatus,
  runEmailIntake,
  saveEmailIntakeConfig,
} from "@/lib/services/email-intake";

export const dynamic = "force-dynamic";

export async function GET() {
  // Status only - the stored password is never returned to the client.
  return NextResponse.json({ status: getEmailIntakeStatus() });
}

const saveSchema = z.object({
  enabled: z.boolean().optional(),
  host: z.string().max(200).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  user: z.string().max(200).optional(),
  /** Empty string = keep the stored password */
  password: z.string().max(500).optional(),
  folder: z.string().max(100).optional(),
});

export async function PUT(req: NextRequest) {
  const parsed = saveSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  saveEmailIntakeConfig(parsed.data);
  return NextResponse.json({ status: getEmailIntakeStatus() });
}

/** "Check now" - run one intake pass immediately. */
export async function POST() {
  const result = await runEmailIntake();
  return NextResponse.json({ ...result, status: getEmailIntakeStatus() });
}
