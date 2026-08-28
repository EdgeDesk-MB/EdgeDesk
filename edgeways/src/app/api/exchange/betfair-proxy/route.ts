import { NextResponse } from "next/server";
import {
  betfairProxyAllowed,
  isAllowedBetfairUpstreamUrl,
} from "@/lib/services/exchange/betfair-proxy-auth";

export const runtime = "edge";
export const preferredRegion = ["lhr1"];
export const dynamic = "force-dynamic";

type ProxyBody = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export async function POST(req: Request) {
  const appKey = process.env.BETFAIR_APP_KEY?.trim() ?? null;
  if (!betfairProxyAllowed(req.headers.get("authorization"), appKey)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let payload: ProxyBody;
  try {
    payload = (await req.json()) as ProxyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const url = payload.url?.trim() ?? "";
  if (!isAllowedBetfairUpstreamUrl(url)) {
    return NextResponse.json({ error: "URL not allowed." }, { status: 400 });
  }

  const method = (payload.method ?? "POST").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
  }

  const upstream = await fetch(url, {
    method,
    headers: payload.headers ?? {},
    body: method === "GET" ? undefined : payload.body,
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
    },
  });
}
