import Link from "next/link";
import { MarketingLogo } from "@/components/marketing/marketing-logo";
import { MarketingSocialLinks } from "@/components/marketing/marketing-social-links";
import { ResponsibleGamblingNote } from "@/components/compliance/responsible-gambling-note";
import { LEGAL_NAV } from "@/lib/legal/public";

export function MarketingSiteFooter({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <footer className="border-t border-white/10 px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <MarketingLogo className="opacity-90" />
          <MarketingSocialLinks className="mt-4" />
          <p className="mt-3 text-xs text-white/55">
            © {new Date().getFullYear()} Edgeways. All rights reserved.
          </p>
        </div>
        <div className="max-w-md space-y-3">
          <ResponsibleGamblingNote className="text-white/55 [&_a]:rounded-sm [&_a]:text-[var(--marketing-brand)] [&_a]:focus-visible:outline [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-[var(--marketing-brand)]" />
          {children}
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {LEGAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-sm text-white/55 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
