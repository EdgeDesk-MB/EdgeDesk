import "server-only";
import { cookies } from "next/headers";
import {
  ADMIN_ACTIVITY_BOARD_COOKIE,
  parseActivityBoard,
  type ActivityBoardLayout,
} from "@/lib/admin/activity-board";

export async function readActivityBoardLayout(): Promise<ActivityBoardLayout> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_ACTIVITY_BOARD_COOKIE)?.value;
  if (!raw) return parseActivityBoard(null);
  try {
    return parseActivityBoard(decodeURIComponent(raw));
  } catch {
    return parseActivityBoard(raw);
  }
}
