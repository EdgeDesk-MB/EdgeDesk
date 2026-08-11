import Link from "next/link";
import type { Metadata } from "next";
import { MarketingLogo } from "@/components/marketing/marketing-logo";

export const metadata: Metadata = {
  title: "Unsubscribed",
  robots: { index: false, follow: false },
};

type Status = "ok" | "already" | "invalid";

function copyFor(status: Status): { title: string; body: string } {
  if (status === "ok") {
    return {
      title: "You're unsubscribed",
      body: "We've removed this email from the Edgeways waitlist. You won't get launch updates from us.",
    };
  }
  if (status === "already") {
    return {
      title: "Already unsubscribed",
      body: "This email is already off the waitlist. Nothing else to do.",
    };
  }
  return {
    title: "Link expired or invalid",
    body: "That unsubscribe link isn't valid. If you're still getting emails, reply to one and ask to be removed.",
  };
}

export default async function WaitlistUnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const raw = params.status;
  const status: Status =
    raw === "ok" || raw === "already" || raw === "invalid" ? raw : "invalid";
  const copy = copyFor(status);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-5 py-16 text-center">
      <MarketingLogo />
      <h1 className="mt-10 text-3xl font-semibold tracking-tight text-white">
        {copy.title}
      </h1>
      <p className="mt-4 text-base text-white/60">{copy.body}</p>
      <Link
        href="/#hero"
        className="mt-10 rounded-md bg-[var(--marketing-brand)] px-5 py-2.5 text-sm font-semibold text-[var(--marketing-ink)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
      >
        Back to Edgeways
      </Link>
    </div>
  );
}
