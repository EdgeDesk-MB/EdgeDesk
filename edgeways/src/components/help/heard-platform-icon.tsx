import type { ReactNode } from "react";
import { CircleHelp, Users } from "lucide-react";
import type { OnboardingHeardId } from "@/lib/onboarding-profile";
import { cn } from "@/lib/utils";

function BrandMark({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("size-4 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

/** Official-colour platform marks for the “how did you hear” step. */
export function HeardPlatformIcon({
  id,
  className,
}: {
  id: OnboardingHeardId;
  className?: string;
}) {
  switch (id) {
    case "reddit":
      return (
        <BrandMark className={className}>
          <circle cx="12" cy="12" r="12" fill="#FF4500" />
          <path
            fill="#fff"
            d="M16.54 11.23c.54 0 .98.44.98.98 0 .41-.25.76-.61.91.03.18.05.37.05.56 0 2.13-2.48 3.86-5.54 3.86s-5.54-1.73-5.54-3.86c0-.19.02-.38.05-.56a.98.98 0 0 1 .37-1.89c.28 0 .53.12.71.31 1.04-.76 2.47-1.24 4.05-1.3l.72-3.38a.33.33 0 0 1 .4-.25l2.53.54a1.15 1.15 0 1 1-.08.65l-2.26-.48-.64 3.02c1.54.08 2.93.56 3.95 1.31.18-.2.44-.32.73-.32zm-6.16 1.63a.98.98 0 1 0-1.96 0 .98.98 0 0 0 1.96 0zm4.2 2.37c-.51.51-1.49.76-2.3.76s-1.79-.25-2.3-.76a.33.33 0 0 1 .47-.47c.38.38 1.15.57 1.83.57s1.45-.19 1.83-.57a.33.33 0 1 1 .47.47zm.16-1.39a.98.98 0 1 0 0-1.96.98.98 0 0 0 0 1.96z"
          />
        </BrandMark>
      );
    case "discord":
      return (
        <BrandMark className={className}>
          <path
            fill="#5865F2"
            d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
          />
        </BrandMark>
      );
    case "google":
      return (
        <BrandMark className={className}>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </BrandMark>
      );
    case "facebook":
      return (
        <BrandMark className={className}>
          <path
            fill="#1877F2"
            d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
          />
        </BrandMark>
      );
    case "youtube":
      return (
        <BrandMark className={className}>
          <path
            fill="#FF0000"
            d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8z"
          />
          <path fill="#fff" d="M9.6 15.6V8.4l6.3 3.6z" />
        </BrandMark>
      );
    case "instagram":
      return (
        <BrandMark className={className}>
          <defs>
            <radialGradient
              id="heard-ig"
              cx="0"
              cy="1"
              r="1.2"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0" stopColor="#fdf497" />
              <stop offset="0.45" stopColor="#fd5949" />
              <stop offset="0.6" stopColor="#d6249f" />
              <stop offset="1" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="url(#heard-ig)" />
          <rect
            x="6.4"
            y="6.4"
            width="11.2"
            height="11.2"
            rx="3.2"
            fill="none"
            stroke="#fff"
            strokeWidth="1.7"
          />
          <circle
            cx="12"
            cy="12"
            r="2.85"
            fill="none"
            stroke="#fff"
            strokeWidth="1.7"
          />
          <circle cx="16.35" cy="7.7" r="1" fill="#fff" />
        </BrandMark>
      );
    case "x":
      return (
        <BrandMark className={className}>
          <path
            fill="#fff"
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.828L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          />
        </BrandMark>
      );
    case "friend":
      return <Users className={cn("size-4 shrink-0", className)} aria-hidden />;
    case "other":
      return (
        <CircleHelp className={cn("size-4 shrink-0", className)} aria-hidden />
      );
  }
}
