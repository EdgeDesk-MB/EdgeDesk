"use client";

/**
 * Email intake settings (J6 stage 2) - IMAP folder pull for promo emails.
 * Honest storage copy: the app password is stored locally UNENCRYPTED like
 * the .env API keys, so a dedicated forwarding mailbox is the way. The
 * stored password never comes back to the client (hasPassword only).
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/hooks/use-app-state";
import { Inbox, Loader2 } from "lucide-react";

type IntakeStatus = {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  folder: string;
  hasPassword: boolean;
  lastResult: string | null;
};

export function EmailIntakeCard() {
  const [status, setStatus] = useState<IntakeStatus | null>(null);
  const [host, setHost] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [folder, setFolder] = useState("Edgeways");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(() => {
    api<{ status: IntakeStatus }>("/api/email-intake")
      .then((r) => {
        setStatus(r.status);
        setHost(r.status.host);
        setUser(r.status.user);
        setFolder(r.status.folder);
      })
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(patch: Record<string, unknown> = {}) {
    setSaving(true);
    try {
      const r = await api<{ status: IntakeStatus }>("/api/email-intake", {
        method: "PUT",
        json: {
          host: host.trim(),
          user: user.trim(),
          folder: folder.trim(),
          ...(password ? { password } : {}),
          ...patch,
        },
      });
      setStatus(r.status);
      setPassword("");
      toast.success("Email intake saved");
    } catch (e) {
      toast.error("Could not save", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function checkNow() {
    setChecking(true);
    try {
      const r = await api<{ created: number; skipped: number; error?: string; status: IntakeStatus }>(
        "/api/email-intake",
        { method: "POST", json: {} }
      );
      setStatus(r.status);
      if (r.error) {
        toast.error("Intake failed", { description: r.error });
      } else {
        toast.success(
          r.created === 0
            ? "No new promo emails"
            : `${r.created} draft${r.created === 1 ? "" : "s"} created`,
          { description: r.skipped > 0 ? `${r.skipped} message(s) skipped (unparseable)` : undefined }
        );
      }
    } finally {
      setChecking(false);
    }
  }

  const configured = status != null && status.host !== "" && status.user !== "" && status.hasPassword;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="size-4" /> Email intake
        </CardTitle>
        <CardDescription>
          Forward promo emails to a folder and the desk drafts them as Planned campaigns for
          review - nothing ever activates itself. The app password is stored locally
          unencrypted (like the API keys), so use a dedicated forwarding mailbox, never your
          main account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <div className="text-sm font-medium">Poll while the desk is open</div>
            <div className="text-xs text-muted-foreground">
              Checks the folder about every 5 minutes; new drafts raise an inbox alert
            </div>
          </div>
          <Switch
            checked={status?.enabled ?? false}
            disabled={!configured && !(status?.enabled ?? false)}
            onCheckedChange={(on) => void save({ enabled: on })}
            aria-label="Enable email intake polling"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-host" className="text-xs text-muted-foreground">
              IMAP host
            </Label>
            <Input
              id="intake-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="imap.gmail.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-user" className="text-xs text-muted-foreground">
              Username
            </Label>
            <Input
              id="intake-user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="edgeways.intake@gmail.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-pass" className="text-xs text-muted-foreground">
              App password {status?.hasPassword ? "(saved - leave blank to keep)" : ""}
            </Label>
            <Input
              id="intake-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={status?.hasPassword ? "••••••••" : "App-specific password"}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-folder" className="text-xs text-muted-foreground">
              Folder / label
            </Label>
            <Input
              id="intake-folder"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="Edgeways"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void checkNow()}
            disabled={checking || !configured}
          >
            {checking ? <Loader2 className="size-3.5 animate-spin" /> : null} Check now
          </Button>
          {status?.lastResult ? (
            <span className="text-xs text-muted-foreground">Last: {status.lastResult}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
