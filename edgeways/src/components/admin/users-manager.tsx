"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/help/empty-state";
import {
  ADMIN_GRANT_CAN,
  ADMIN_GRANT_CAN_LABEL,
  ADMIN_GRANT_CANNOT,
  ADMIN_GRANT_CANNOT_LABEL,
  ADMIN_GRANT_HEADLINE,
  ADMIN_REVOKE_CAN_LABEL,
  ADMIN_REVOKE_CANNOT_LABEL,
  ADMIN_REVOKE_HEADLINE,
  adminGrantLead,
} from "@/lib/admin/copy";
import { formatAdminDateTime } from "@/lib/admin/format";
import { adminAccessLock } from "@/lib/admin/roles";
import type { AdminUserRow } from "@/lib/services/app-users";
import { Shield } from "lucide-react";
import { captionHeading, tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export function UsersManager({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<AdminUserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => user.email?.toLowerCase().includes(needle));
  }, [users, query]);

  const adminCount = users.filter((user) => user.admin).length;
  const granting = pending ? !pending.admin : false;

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkUserId: pending.clerkUserId,
          role: granting ? "admin" : "user",
        }),
      });
      const body = (await res.json()) as { error?: string; user?: AdminUserRow };
      if (!res.ok || !body.user) {
        toast.error(body.error ?? "Could not update access.");
        return;
      }
      setUsers((current) =>
        current.map((user) =>
          user.clerkUserId === body.user!.clerkUserId ? body.user! : user
        )
      );
      toast.success(granting ? "Admin access granted." : "Admin access revoked.");
      setPending(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-sm flex-col gap-1.5">
        <Label htmlFor="admin-user-search">Search by email</Label>
        <Input
          id="admin-user-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="name@example.com"
          autoComplete="off"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={users.length === 0 ? "No accounts yet" : "No matching emails"}
          description={
            users.length === 0
              ? "Accounts appear here after someone signs in."
              : "Try a different email."
          }
        />
      ) : (
        <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={tableHeaderCell}>Email</TableHead>
              <TableHead className={tableHeaderCell}>Plan</TableHead>
              <TableHead className={tableHeaderCell}>Last active</TableHead>
              <TableHead className={tableHeaderCell}>Admin</TableHead>
              <TableHead className={cn(tableHeaderCell, "text-right")}>Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => {
              const lock = adminAccessLock(user, adminCount);
              return (
              <TableRow key={user.clerkUserId}>
                <TableCell className={cn(tableBodyCell, "max-w-[18rem] truncate font-medium")}>
                  {user.email ?? user.clerkUserId}
                  {user.bootstrap ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Bootstrap
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className={cn(tableBodyCell, "capitalize")}>{user.plan}</TableCell>
                <TableCell className={tableBodyCell}>{formatAdminDateTime(user.updatedAt)}</TableCell>
                <TableCell className={tableBodyCell}>
                  {user.admin ? (
                    <Badge variant="secondary">Admin</Badge>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className={cn(tableBodyCell, "text-right")}>
                  {lock === "bootstrap" ? (
                    <span className="text-xs text-muted-foreground">Locked</span>
                  ) : lock === "last-admin" ? (
                    <span className="text-xs text-muted-foreground">Last admin</span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={user.admin ? "outline" : "default"}
                      onClick={() => setPending(user)}
                    >
                      {user.admin ? "Revoke admin" : "Grant admin"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </AdminTableFrame>
      )}

      <Dialog open={pending != null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{granting ? "Grant admin access" : "Revoke admin access"}</DialogTitle>
            <DialogDescription>
              {granting
                ? adminGrantLead(pending?.email ?? pending?.clerkUserId ?? "this account")
                : ADMIN_REVOKE_HEADLINE}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className={captionHeading}>
                {granting ? ADMIN_GRANT_CAN_LABEL : ADMIN_REVOKE_CAN_LABEL}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                {ADMIN_GRANT_CAN.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className={captionHeading}>
                {granting ? ADMIN_GRANT_CANNOT_LABEL : ADMIN_REVOKE_CANNOT_LABEL}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                {ADMIN_GRANT_CANNOT.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
          {granting ? (
            <p className="text-sm text-muted-foreground">{ADMIN_GRANT_HEADLINE}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={granting ? "default" : "destructive"}
              disabled={busy}
              onClick={() => void confirm()}
            >
              {granting ? "Grant admin" : "Revoke admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
