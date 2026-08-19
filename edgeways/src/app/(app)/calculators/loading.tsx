import { PageShell } from "@/components/page-shell";

export default function CalculatorsLoading() {
  return (
    <PageShell>
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading calculators">
        <div className="h-8 w-56 max-w-full rounded-md bg-muted" />
        <div className="h-4 w-full max-w-md rounded-md bg-muted" />
        <div className="mt-4 h-40 w-full rounded-xl bg-muted" />
      </div>
    </PageShell>
  );
}
