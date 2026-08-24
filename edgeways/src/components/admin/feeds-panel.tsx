"use client";

import { useState } from "react";
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

export function FeedsPanel({ initial }: { initial: FeedStatus }) {
  const [status, setStatus] = useState(initial);
  const [testing, setTesting] = useState<"football" | "racing" | "exchange" | null>(
    null
  );

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

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Football</CardTitle>
          <CardDescription>Operator-held live scores and fixtures.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Badge variant={status.football.configured ? "default" : "outline"}>
            {status.football.configured ? "Configured" : "Not connected"}
          </Badge>
          <p className="text-sm text-muted-foreground">
            Today: {status.football.used}/{status.football.budget} requests
          </p>
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
            {status.racing.configured ? "Configured" : "Not connected"}
          </Badge>
          <p className="text-sm text-muted-foreground">
            Today: {status.racing.used} requests logged
          </p>
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
          <CardDescription>Delayed lay prices. No deploy from here.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(status.exchange.providers.length
            ? status.exchange.providers
            : [{ provider: "betfair", ok: false, status: "unknown" }]
          ).map((provider) => (
            <div key={provider.provider} className="flex items-center justify-between gap-2">
              <span className="capitalize">{provider.provider}</span>
              <Badge variant={provider.ok ? "default" : "outline"}>
                {provider.status}
              </Badge>
            </div>
          ))}
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
