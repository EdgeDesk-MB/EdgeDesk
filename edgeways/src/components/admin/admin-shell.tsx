import { AdminNav } from "@/components/admin/admin-nav";
import {
  appShellGap,
  appShellMaxWidth,
  appShellPadding,
} from "@/lib/ui/app-shell-layout";
import { pagePanel } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-scroll min-h-0 flex-1 overflow-x-clip overflow-y-auto">
      <div
        className={cn(
          "flex w-full items-stretch",
          appShellPadding,
          appShellGap,
          appShellMaxWidth
        )}
      >
        <AdminNav />
        <div className="flex min-w-0 flex-1 flex-col p-0 sm:p-1">
          <main
            className={cn(
              pagePanel,
              "flex w-full flex-col",
              "max-sm:rounded-none max-sm:shadow-none max-sm:ring-0"
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
