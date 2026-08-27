import "server-only";
import { cookies } from "next/headers";
import {
  ADMIN_EXCLUDE_ADMINS_COOKIE,
  parseExcludeAdminsFlag,
} from "@/lib/admin/exclude-admins";

export async function readExcludeAdmins(): Promise<boolean> {
  const jar = await cookies();
  return parseExcludeAdminsFlag(jar.get(ADMIN_EXCLUDE_ADMINS_COOKIE)?.value);
}
