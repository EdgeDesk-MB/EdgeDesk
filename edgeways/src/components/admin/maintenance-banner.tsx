"use client";

const bannerClassName =
  "bg-warning px-4 py-2 text-center text-sm font-medium text-white";

export function MaintenanceBannerView({ message }: { message: string }) {
  return (
    <div role="status" className={bannerClassName}>
      {message}
    </div>
  );
}
