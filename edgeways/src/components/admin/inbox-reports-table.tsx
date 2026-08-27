"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDateTime } from "@/lib/admin/format";
import { FEEDBACK_KIND_LABELS, type FeedbackListItem } from "@/lib/feedback/types";
import { tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function reportFrom(report: FeedbackListItem): string {
  return (
    report.replyEmail ?? report.diagnostics.signedInEmail ?? "—"
  );
}

export function InboxReportsTable({ reports }: { reports: FeedbackListItem[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = reports.find((report) => report.id === openId) ?? null;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={tableHeaderCell}>Kind</TableHead>
            <TableHead className={tableHeaderCell}>Summary</TableHead>
            <TableHead className={tableHeaderCell}>From</TableHead>
            <TableHead className={tableHeaderCell}>When</TableHead>
            <TableHead className={tableHeaderCell}>Linear</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow
              key={report.id}
              className="cursor-pointer"
              onClick={() => setOpenId(report.id)}
            >
              <TableCell className={tableBodyCell}>
                {FEEDBACK_KIND_LABELS[report.kind]}
              </TableCell>
              <TableCell
                className={cn(tableBodyCell, "max-w-[22rem]")}
                title={report.summary}
              >
                <p className="truncate font-medium">{report.summary}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {report.details}
                </p>
              </TableCell>
              <TableCell className={cn(tableBodyCell, "text-muted-foreground")}>
                {reportFrom(report)}
              </TableCell>
              <TableCell className={tableBodyCell}>
                {formatAdminDateTime(report.createdAt)}
              </TableCell>
              <TableCell className={cn(tableBodyCell, "text-muted-foreground")}>
                {report.linearIssueId ?? "Unfiled"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open != null} onOpenChange={(next) => !next && setOpenId(null)}>
        {open ? (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{open.summary}</DialogTitle>
              <DialogDescription>
                {FEEDBACK_KIND_LABELS[open.kind]} · {formatAdminDateTime(open.createdAt)}
                {open.linearIssueId ? ` · ${open.linearIssueId}` : " · Unfiled"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 overflow-y-auto">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Details
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-pretty break-words text-foreground">
                  {open.details}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  From
                </p>
                <p className="mt-1 text-sm text-foreground">{reportFrom(open)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Diagnostics
                </p>
                <dl className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0">Page</dt>
                    <dd className="min-w-0 break-all">{open.diagnostics.href || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0">App version</dt>
                    <dd>{open.diagnostics.appVersion}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0">Timezone</dt>
                    <dd>{open.diagnostics.timezone}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0">User agent</dt>
                    <dd className="min-w-0 break-all">{open.diagnostics.userAgent}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
