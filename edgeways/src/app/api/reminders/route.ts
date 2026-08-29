import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  cancelUserReminder,
  createUserReminder,
  fireDueUserReminders,
  listPendingRemindersForCasino,
  listPendingRemindersForOffer,
} from "@/lib/services/user-reminders";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  cancelNeonUserReminder,
  createNeonUserReminder,
  fireDueNeonUserReminders,
  listNeonPendingRemindersForCasino,
  listNeonPendingRemindersForOffer,
} from "@/lib/db/neon-desk-reminders";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  note: z.string().trim().min(1).max(500),
  remindAt: z.number().finite(),
  casinoOfferId: z.number().int().positive().optional().nullable(),
  offerId: z.number().int().positive().optional().nullable(),
  contextTitle: z.string().trim().max(200).optional().nullable(),
  contextVenue: z.string().trim().max(120).optional().nullable(),
});

const cancelSchema = z.object({
  id: z.number().int().positive(),
});

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const casinoOfferId = Number(req.nextUrl.searchParams.get("casinoOfferId"));
  const offerId = Number(req.nextUrl.searchParams.get("offerId"));
  if (isNeonDesk()) {
    const fired = await fireDueNeonUserReminders();
    const pending =
      Number.isFinite(casinoOfferId) && casinoOfferId > 0
        ? await listNeonPendingRemindersForCasino(casinoOfferId)
        : Number.isFinite(offerId) && offerId > 0
          ? await listNeonPendingRemindersForOffer(offerId)
          : [];
    return NextResponse.json({ fired, pending });
  }
  const fired = fireDueUserReminders();
  const pending =
    Number.isFinite(casinoOfferId) && casinoOfferId > 0
      ? listPendingRemindersForCasino(casinoOfferId)
      : Number.isFinite(offerId) && offerId > 0
        ? listPendingRemindersForOffer(offerId)
        : [];
  return NextResponse.json({ fired, pending });
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const reminder = isNeonDesk()
      ? await createNeonUserReminder(parsed.data)
      : createUserReminder(parsed.data);
    return NextResponse.json({ reminder });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
});

export const DELETE = withDeskScope(async function DELETE(req: NextRequest) {
  const parsed = cancelSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const ok = isNeonDesk()
    ? await cancelNeonUserReminder(parsed.data.id)
    : cancelUserReminder(parsed.data.id);
  if (!ok) return NextResponse.json({ error: "Reminder not found or already used" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
