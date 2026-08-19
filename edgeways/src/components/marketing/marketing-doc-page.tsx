import Link from "next/link";
import { MarketingLogo } from "@/components/marketing/marketing-logo";
import { MarketingSiteFooter } from "@/components/marketing/marketing-site-footer";

export function MarketingDocPage({
  title,
  lede,
  wide = false,
  children,
}: {
  title: string;
  lede?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const measure = wide ? "max-w-3xl" : "max-w-2xl";

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-[var(--marketing-band-deep)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <MarketingLogo />
        <Link
          href="/"
          className="rounded-md px-2 py-1.5 text-sm text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
        >
          Back to Edgeways
        </Link>
      </header>
      <main
        className={`mx-auto w-full min-w-0 flex-1 px-5 py-16 sm:px-8 sm:py-20 ${measure}`}
      >
        <h1 className={`${measure} text-2xl font-semibold tracking-tight text-white text-pretty break-words sm:text-3xl`}>
          {title}
        </h1>
        {lede ? (
          <div className={`mt-3 ${measure} space-y-1 text-sm text-white/55 sm:text-base`}>
            {lede}
          </div>
        ) : null}
        <div className={`mt-10 min-w-0 ${measure} space-y-4 text-sm leading-relaxed text-white/60 text-pretty break-words sm:text-base [&_a]:rounded-sm [&_a]:text-[var(--marketing-brand)] [&_a]:underline-offset-2 [&_a]:hover:underline [&_a]:focus-visible:outline [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-[var(--marketing-brand)] [&_h2]:mt-10 [&_h2]:border-t [&_h2]:border-[color-mix(in_srgb,var(--marketing-brand)_40%,transparent)] [&_h2]:pt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-white sm:[&_h2]:text-xl [&_h2]:first:mt-0 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_.legal-table]:max-w-full [&_.legal-table]:min-w-0 [&_.legal-table]:overflow-x-auto [&_table]:w-full [&_table]:text-left [&_table]:text-sm [&_th]:pb-2 [&_th]:pr-3 [&_th]:align-top [&_th]:font-semibold [&_th]:text-white/80 [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_td]:text-white/60`}>
          {children}
        </div>
      </main>
      <MarketingSiteFooter />
    </div>
  );
}
