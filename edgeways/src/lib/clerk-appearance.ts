import { shadcn } from "@clerk/ui/themes";

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
 * Edgeways ink + brand yellow — shared by ClerkProvider and auth pages.
 * Auth is pinned dark (see `(auth)/layout`). Do not follow the desk theme.
 * Clerk’s shadcn theme maps the footer to host `--card` / `--color-card`.
 * Those aliases are re-bound on `.dark` and `.marketing-root` in globals.css
 * so a light html does not paint a white strip under the ink card.
 * Colours come from the marketing plate (`--card`, `--marketing-brand`),
 * not the desk `--brand` toggle.
 */
export const EDGEWAYS_CLERK_APPEARANCE = {
  theme: shadcn,
  variables: {
    colorPrimary: "var(--marketing-brand)",
    colorPrimaryForeground: "var(--marketing-ink)",
    colorBackground: "var(--card)",
    colorForeground: "var(--card-foreground)",
    colorMuted: "var(--muted)",
    colorMutedForeground: "var(--muted-foreground)",
    colorInput: "var(--marketing-ink)",
    colorInputForeground: "var(--card-foreground)",
    colorNeutral: "var(--card-foreground)",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    rootBox: "mx-auto w-full max-w-[400px]",
    cardBox: "shadow-none",
    card: "border border-white/10 bg-card shadow-none",
    logoBox: "mx-auto mb-3 flex justify-center",
    logoImage: "size-10",
    headerTitle: "text-card-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButton:
      "border border-white/15 bg-[var(--marketing-ink)] text-card-foreground hover:bg-white/5",
    formButtonPrimary:
      "bg-[var(--marketing-brand)] text-[var(--marketing-ink)] hover:opacity-90 font-semibold",
    footer: "border-t border-white/10 bg-card text-muted-foreground",
    cardFooter: "border-t border-white/10 bg-card text-muted-foreground",
    footerActionText: "text-muted-foreground",
    footerActionLink:
      "text-[var(--marketing-brand)] hover:underline",
    footerPages: "text-white/55",
    footerPagesLink: "text-white/55 hover:text-card-foreground",
    identityPreviewEditButton: "text-[var(--marketing-brand)]",
    formFieldInput:
      "border-white/15 bg-[var(--marketing-ink)] text-card-foreground placeholder:text-white/40",
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
