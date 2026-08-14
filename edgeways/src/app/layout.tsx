import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import {
  EDGEWAYS_CLERK_APPEARANCE,
  EDGEWAYS_CLERK_LOCALIZATION,
} from "@/lib/clerk-appearance";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandAccentProvider } from "@/components/brand-accent-provider";
import { UiFontProvider } from "@/components/ui-font-provider";
import { HeaderPatternProvider } from "@/components/header-pattern-provider";
import { BrandStorageMigration } from "@/components/brand-storage-migration";
import { SyncAppUser } from "@/components/sync-app-user";
import { BRAND_ACCENT_FOUC_SCRIPT } from "@/lib/brand-accent-fouc";
import {
  BRAND_ACCENT_COOKIE_KEY,
  brandAccentStyle,
  deriveBrandAccent,
  normalizeHex,
} from "@/lib/brand-accent";
import { UI_FONT_FOUC_SCRIPT } from "@/lib/ui-font-fouc";
import {
  DEFAULT_UI_FONT,
  normalizeUiFont,
  UI_FONT_ATTR,
  UI_FONT_COOKIE_KEY,
} from "@/lib/ui-font";
import { HEADER_PATTERN_FOUC_SCRIPT } from "@/lib/header-pattern-fouc";
import {
  DEFAULT_HEADER_PATTERN,
  HEADER_PATTERN_ATTR,
  HEADER_PATTERN_COOKIE_KEY,
  normalizeHeaderPattern,
} from "@/lib/header-pattern";
import { figtree, geistMono, notoSans } from "@/fonts";
import {
  SHARE_LOCALE,
  SHARE_SITE_NAME,
  marketingShareCopy,
  publicSiteUrl,
} from "@/lib/marketing/share-metadata";

const rootShare = marketingShareCopy("waitlist");

export const metadata: Metadata = {
  metadataBase: publicSiteUrl(),
  applicationName: SHARE_SITE_NAME,
  title: {
    default: "Edgeways",
    template: "%s · Edgeways",
  },
  description: rootShare.description,
  // Outbound bookie/casino clicks must not send Edgeways as Referer.
  referrer: "no-referrer",
  // Icons: src/app/icon.tsx (accent-tinted favicon from brand cookie) and
  // src/app/apple-icon.png (static iOS home screen).
  openGraph: {
    type: "website",
    locale: SHARE_LOCALE,
    siteName: SHARE_SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
  },
};

/** viewport-fit=cover makes env(safe-area-inset-*) live for the mobile sheets. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Pin browser chrome to ink. Dia samples the top element’s background-color
  // (see AppTopBar — <header> is always #111; yellow is an inner shell) and
  // also respects theme-color / manifest theme_color when present.
  themeColor: "#111111",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const cookieHex = normalizeHex(jar.get(BRAND_ACCENT_COOKIE_KEY)?.value);
  const accentDerived = cookieHex ? deriveBrandAccent(cookieHex) : null;
  const accentStyle = accentDerived
    ? (brandAccentStyle(cookieHex!) as CSSProperties)
    : undefined;
  const cookieFont = normalizeUiFont(jar.get(UI_FONT_COOKIE_KEY)?.value);
  const cookiePattern = normalizeHeaderPattern(
    jar.get(HEADER_PATTERN_COOKIE_KEY)?.value
  );

  return (
    <html
      lang="en"
      className={`${notoSans.variable} ${figtree.variable} ${geistMono.variable} min-h-full antialiased`}
      style={accentStyle}
      {...(accentDerived
        ? { "data-brand-plate": accentDerived.brandPlateDark ? "dark" : "light" }
        : {})}
      {...(cookieFont !== DEFAULT_UI_FONT
        ? { [UI_FONT_ATTR]: cookieFont }
        : {})}
      {...(cookiePattern !== DEFAULT_HEADER_PATTERN
        ? { [HEADER_PATTERN_ATTR]: cookiePattern }
        : {})}
      suppressHydrationWarning
    >
      <head>
        {/*
          Blocking FOUC scripts. React 19 logs a false-positive
          “Encountered a script tag” warning for these on client render;
          ThemeProvider filters that specific console.error in dev.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: BRAND_ACCENT_FOUC_SCRIPT }}
        />
        <script dangerouslySetInnerHTML={{ __html: UI_FONT_FOUC_SCRIPT }} />
        <script
          dangerouslySetInnerHTML={{ __html: HEADER_PATTERN_FOUC_SCRIPT }}
        />
      </head>
      <body className="min-h-full bg-canvas">
        <ClerkProvider
          appearance={EDGEWAYS_CLERK_APPEARANCE}
          localization={EDGEWAYS_CLERK_LOCALIZATION}
        >
          <BrandStorageMigration />
          <SyncAppUser />
          <ThemeProvider>
            <BrandAccentProvider>
              <UiFontProvider>
                <HeaderPatternProvider>{children}</HeaderPatternProvider>
              </UiFontProvider>
            </BrandAccentProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
