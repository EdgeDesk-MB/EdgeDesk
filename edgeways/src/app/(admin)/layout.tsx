import type { Metadata } from "next";
import { Toaster, adminToasterOffset } from "@/components/ui/sonner";
import { AdminLiveProvider } from "@/components/admin/admin-live-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { MaintenanceBannerServer } from "@/components/admin/maintenance-banner-server";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { requireAdminPage } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return (
    <AdminLiveProvider>
      <div className="flex h-dvh max-w-full flex-col overflow-hidden">
        <MaintenanceBannerServer />
        <AdminTopBar />
        <AdminShell>{children}</AdminShell>
        <Toaster
          richColors
          position="top-right"
          offset={adminToasterOffset}
          mobileOffset={adminToasterOffset}
        />
      </div>
    </AdminLiveProvider>
  );
}
