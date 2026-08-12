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

/** Edgeways ink + brand yellow — shared by ClerkProvider and auth pages. */
export const EDGEWAYS_CLERK_APPEARANCE = {
  theme: shadcn,
  variables: {
    colorPrimary: "#FFC71E",
    colorPrimaryForeground: "#111111",
    colorBackground: "#1a1a1a",
    colorForeground: "#f5f5f0",
    colorMutedForeground: "rgba(245,245,240,0.65)",
    colorInput: "#111111",
    colorInputForeground: "#f5f5f0",
    colorNeutral: "#f5f5f0",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    rootBox: "mx-auto w-full max-w-[400px]",
    cardBox: "shadow-none",
    card: "border border-white/10 bg-[#1a1a1a] shadow-none",
    logoBox: "mx-auto mb-3 flex justify-center",
    logoImage: "size-10",
    headerTitle: "text-[#f5f5f0]",
    headerSubtitle: "text-[rgba(245,245,240,0.6)]",
    socialButtonsBlockButton:
      "border border-white/15 bg-[#111111] text-[#f5f5f0] hover:bg-[#222]",
    formButtonPrimary:
      "bg-[#FFC71E] text-[#111111] hover:bg-[#ffd24d] font-semibold",
    footerActionLink: "text-[#FFC71E] hover:text-[#ffd24d]",
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
