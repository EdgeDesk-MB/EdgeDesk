import { AdminLiveLog } from "@/components/admin/admin-live-log";
import { ingestAdminLiveLog, listAdminLiveLog } from "@/lib/admin/live-log";
import type { AdminLiveLogList } from "@/lib/admin/live-log-shared";

export const dynamic = "force-dynamic";

const EMPTY_LOG: AdminLiveLogList = { rows: [], unread: 0, truncated: false };

export default async function AdminLivePage() {
  try {
    await ingestAdminLiveLog({ force: true, pingNeon: false });
    const initial = await listAdminLiveLog();
    return <AdminLiveLog initial={initial} />;
  } catch {
    return <AdminLiveLog initial={EMPTY_LOG} initialError />;
  }
}
