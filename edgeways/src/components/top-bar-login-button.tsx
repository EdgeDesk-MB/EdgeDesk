"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { useClerk, useUser } from "@clerk/nextjs";
import { drawerUtilityRow } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Desktop meta-row Log out: type matches meta tabs, no ChromeTab plate. */
const logoutControl =
  "group relative flex shrink-0 touch-manipulation items-center gap-1.5 pt-1.5 pb-2 text-xs font-medium tracking-tight text-topbar-muted outline-none motion-reduce:transition-none focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-topbar-foreground/30";

function useSignOut() {
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);
  const logOut = () => {
    if (pending) return;
    setPending(true);
    void signOut({ redirectUrl: "/" }).finally(() => setPending(false));
  };
  return { pending, logOut };
}

const labelCrossfade =
  "col-start-1 row-start-1 max-w-full min-w-0 truncate text-right transition-opacity duration-500 ease-in-out motion-reduce:transition-none";

function signedInEmail(user: ReturnType<typeof useUser>["user"]): string | null {
  return (
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null
  );
}

/** Desktop meta-nav Log in. Same slot as Log out when the session is empty. */
export function TopBarLoginButton({ className }: { className?: string }) {
  return (
    <Link
      href="/login"
      data-meta-nav="login"
      className={cn(logoutControl, className)}
      aria-label="Log in"
    >
      <span>Log in</span>
      <LogIn className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
    </Link>
  );
}

/** Desktop meta-nav session control: Log out when signed in, Log in when not. */
export function TopBarSessionButton({ className }: { className?: string }) {
  const { isLoaded, isSignedIn } = useUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  // Clerk's isLoaded can differ between SSR and the first client paint.
  // Wait until mount so admin/desk chrome hydrates as the same empty slot.
  if (!mounted || !isLoaded) return null;
  if (isSignedIn) return <TopBarLogoutButton className={className} />;
  return <TopBarLoginButton className={className} />;
}

/** Desktop meta-nav Log out. */
export function TopBarLogoutButton({ className }: { className?: string }) {
  const { pending, logOut } = useSignOut();
  const { user } = useUser();
  const email = signedInEmail(user);

  return (
    <button
      type="button"
      data-meta-nav="logout"
      className={cn(logoutControl, "disabled:opacity-60", className)}
      aria-label="Log out"
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={logOut}
    >
      {email ? (
        <span className="grid max-w-[16rem] min-w-0 justify-items-end">
          <span
            className={cn(labelCrossfade, "group-hover:opacity-0 group-focus-visible:opacity-0")}
            aria-hidden
          >
            {email}
          </span>
          <span
            className={cn(labelCrossfade, "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")}
            aria-hidden
          >
            Log out
          </span>
        </span>
      ) : (
        <span>Log out</span>
      )}
      <LogOut
        className="size-3.5 shrink-0"
        strokeWidth={2.25}
        aria-hidden
      />
    </button>
  );
}

/** Burger drawer footer: Log out when signed in, Log in when not. */
export function MobileDrawerSessionButton({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { isLoaded, isSignedIn } = useUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  if (!mounted || !isLoaded) return null;
  if (isSignedIn) return <MobileDrawerLogoutButton onLoggedOut={onNavigate} />;
  return (
    <Link
      href="/login"
      className={cn(drawerUtilityRow, "border-t border-border/80")}
      onClick={onNavigate}
    >
      <LogIn className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
      <span className="flex-1 text-left">Log in</span>
    </Link>
  );
}

/** Burger drawer footer action. */
export function MobileDrawerLogoutButton({
  onLoggedOut,
}: {
  onLoggedOut?: () => void;
}) {
  const { pending, logOut } = useSignOut();

  return (
    <button
      type="button"
      className={cn(drawerUtilityRow, "border-t border-border/80 disabled:opacity-60")}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={() => {
        onLoggedOut?.();
        logOut();
      }}
    >
      <LogOut className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
      <span className="flex-1 text-left">Log out</span>
    </button>
  );
}
