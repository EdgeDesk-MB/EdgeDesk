import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { MaintenanceBannerServer } from "@/components/admin/maintenance-banner-server";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { requireAdminPage } from "@/lib/admin/session";

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
    <div className="flex h-dvh max-w-full flex-col overflow-hidden">
      <MaintenanceBannerServer />
      <AdminTopBar />
      <AdminShell>{children}</AdminShell>
      <Toaster richColors position="top-right" />
    </div>
  );
}
