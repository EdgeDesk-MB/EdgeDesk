import { dark, shadcn } from "@clerk/ui/themes";

/** Copy overrides so Clerk never falls back to “My Application”. */
export const EDGEWAYS_CLERK_LOCALIZATION = {
  signIn: {
    start: {
      title: "Sign in to Edgeways",
      subtitle: "Open your matched betting desk.",
    },
  },
  signUp: {
    start: {
      title: "Create your Edgeways account",
      subtitle: "Early access to the desk in about a minute.",
    },
  },
};

/**
 * Marketing plate literals. Clerk applies `variables` against `html`, which
 * stays desk-light (`defaultTheme="light"`). Do not use `var(--card)` or
 * `--marketing-*` here: those resolve to the light :root on production.
 * Same paints as `--marketing-brand` / `--marketing-panel-inset` / `--marketing-fg`.
 */
const MARKETING_BRAND = "#FFC71E";
const MARKETING_INK = "#111111";
const MARKETING_PANEL = "#1a1a1a";
const MARKETING_FG = "#f5f5f0";

/**
 * Edgeways ink + brand yellow — shared by ClerkProvider and auth pages.
 * `dark` after `shadcn` so Clerk chrome is not the light shadcn host theme.
 * Auth layout is also `dark` + `scheme-dark` (see `(auth)/layout`).
 */
export const EDGEWAYS_CLERK_APPEARANCE = {
  theme: [shadcn, dark],
  variables: {
    colorPrimary: MARKETING_BRAND,
    colorPrimaryForeground: MARKETING_INK,
    colorBackground: MARKETING_PANEL,
    colorForeground: MARKETING_FG,
    colorMuted: MARKETING_PANEL,
    colorMutedForeground: "rgba(245,245,240,0.65)",
    colorInput: MARKETING_INK,
    colorInputForeground: MARKETING_FG,
    colorNeutral: MARKETING_FG,
    borderRadius: "0.5rem",
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    rootBox: "mx-auto w-full max-w-[400px]",
    cardBox: "shadow-none",
    card: "border border-white/10 bg-[#1a1a1a] text-[#f5f5f0] shadow-none",
    logoBox: "mx-auto mb-3 flex justify-center",
    logoImage: "size-10",
    headerTitle: "text-[#f5f5f0]",
    headerSubtitle: "text-[rgba(245,245,240,0.6)]",
    socialButtonsBlockButton:
      "border border-white/15 bg-[#111111] text-[#f5f5f0] hover:bg-[#222]",
    formButtonPrimary:
      "bg-[#FFC71E] text-[#111111] hover:opacity-90 font-semibold",
    footer: "border-t border-white/10 bg-[#1a1a1a] text-[rgba(245,245,240,0.65)]",
    cardFooter:
      "border-t border-white/10 bg-[#1a1a1a] text-[rgba(245,245,240,0.65)]",
    footerActionText: "text-[rgba(245,245,240,0.65)]",
    footerActionLink: "text-[#FFC71E] hover:underline",
    footerPages: "text-white/55",
    footerPagesLink: "text-white/55 hover:text-[#f5f5f0]",
    identityPreviewEditButton: "text-[#FFC71E]",
    formFieldInput:
      "border-white/15 bg-[#111111] text-[#f5f5f0] placeholder:text-white/40",
    dividerLine: "bg-white/10",
    dividerText: "text-white/50",
  },
  layout: {
    // Square bolt mark — reads cleaner than the full lockup in the card.
    logoImageUrl: "/brand/mark.svg",
    logoPlacement: "inside" as const,
    socialButtonsVariant: "blockButton" as const,
    socialButtonsPlacement: "top" as const,
    // Dev-instance orange “Development mode” strip; harmless to suppress locally.
    unsafe_disableDevelopmentModeWarnings: true,
  },
};
