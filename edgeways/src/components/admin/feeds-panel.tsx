"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FeedStatus } from "@/lib/admin/feeds";
import type { FeedHeartbeat, FeedHeartbeatKind } from "@/lib/admin/feed-heartbeat";
import { formatAdminDateTime } from "@/lib/admin/format";

type ExchangeProviderRow = FeedStatus["exchange"]["providers"][number];

function HeartbeatLine({ heartbeat }: { heartbeat: FeedHeartbeat }) {
  if (heartbeat.lastOkAt == null && heartbeat.lastErrorAt == null) {
    return <p className="text-xs text-muted-foreground">No checks recorded yet.</p>;
  }
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {heartbeat.lastOkAt != null ? (
        <p className="text-success">
          Last OK {formatAdminDateTime(heartbeat.lastOkAt)}
        </p>
      ) : null}
      {heartbeat.lastErrorAt != null ? (
        <p className="min-w-0 text-pretty break-words text-destructive">
          Last error {formatAdminDateTime(heartbeat.lastErrorAt)}
          {heartbeat.lastError ? `: ${heartbeat.lastError}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function exchangeBadgeVariant(
  row: ExchangeProviderRow
): "default" | "outline" | "secondary" {
  if (row.status === "connected") return "default";
  if (row.status === "unsupported") return "secondary";
  return "outline";
}

function exchangeStatusLabel(row: ExchangeProviderRow): string {
  if (row.status === "connected") {
    return row.feedType === "delayed" ? "Connected (delayed)" : "Connected";
  }
  if (row.status === "not_configured") return "Not configured";
  if (row.status === "unsupported") return "Partner API required";
  if (row.status === "disconnected") return "Disconnected";
  return row.status;
}

export function FeedsPanel({
  initial,
  heartbeats,
}: {
  initial: FeedStatus;
  heartbeats: Record<FeedHeartbeatKind, FeedHeartbeat>;
}) {
  const [status, setStatus] = useState(initial);
  const [testing, setTesting] = useState<"football" | "racing" | "exchange" | null>(
    null
  );

  useEffect(() => {
    if (testing) return;
    setStatus(initial);
  }, [initial, testing]);

  async function test(kind: "football" | "racing" | "exchange") {
    setTesting(kind);
    try {
      const res = await fetch("/api/admin/feeds/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        status?: FeedStatus;
        error?: string;
      };
      if (body.status) setStatus(body.status);
      if (!res.ok || body.ok === false) {
        toast.error(body.message ?? body.error ?? "Feed test failed.");
        return;
      }
      toast.success(body.message ?? "Feed responded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Feed test failed.");
    } finally {
      setTesting(null);
    }
  }

  const exchangeProviders = status.exchange.providers.length
    ? status.exchange.providers
    : [{ provider: "betfair", ok: false, status: "unknown" }];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Football</CardTitle>
          <CardDescription>Operator-held live scores and fixtures.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Badge variant={status.football.configured ? "default" : "outline"}>
            {status.football.configured ? "Configured" : "Not configured"}
          </Badge>
          <p className="text-sm text-muted-foreground">
            Today: {status.football.used}/{status.football.budget} requests
          </p>
          <HeartbeatLine heartbeat={heartbeats.football} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testing != null || !status.football.configured}
            onClick={() => void test("football")}
          >
            {testing === "football" ? "Testing…" : "Test football feed"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Racing</CardTitle>
          <CardDescription>Racecards and results for Racing Desk.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Badge variant={status.racing.configured ? "default" : "outline"}>
            {status.racing.configured ? "Configured" : "Not configured"}
          </Badge>
          <p className="text-sm text-muted-foreground">
            Today: {status.racing.used} requests logged
          </p>
          <HeartbeatLine heartbeat={heartbeats.racing} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testing != null || !status.racing.configured}
            onClick={() => void test("racing")}
          >
            {testing === "racing" ? "Testing…" : "Test racing feed"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exchange</CardTitle>
          <CardDescription>
            Delayed lay prices. One feed serves every Edge desk.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {exchangeProviders.map((provider) => (
            <div key={provider.provider} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="capitalize">{provider.provider}</span>
                <Badge variant={exchangeBadgeVariant(provider)}>
                  {exchangeStatusLabel(provider)}
                </Badge>
              </div>
              {provider.message ? (
                <p className="min-w-0 text-pretty break-words text-xs text-muted-foreground">
                  {provider.message}
                </p>
              ) : null}
            </div>
          ))}
          <HeartbeatLine heartbeat={heartbeats.exchange} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testing != null}
            onClick={() => void test("exchange")}
          >
            {testing === "exchange" ? "Testing…" : "Test exchange connection"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
