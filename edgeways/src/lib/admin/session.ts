import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { isOperatorAdmin } from "@/lib/admin/emails";
import { primaryClerkEmail } from "@/lib/db/desk-scope";
import { ensureAppUser, type AppUser } from "@/lib/services/app-users";

export type AdminSession = {
  clerkUserId: string;
  email: string | null;
  user: AppUser;
};

export async function readAdminSession(): Promise<{
  signedIn: boolean;
  admin: boolean;
  session: AdminSession | null;
}> {
  const { userId } = await auth();
  if (!userId) {
    return { signedIn: false, admin: false, session: null };
  }
  const clerkUser = await currentUser();
  const email = primaryClerkEmail(clerkUser);
  const user = await ensureAppUser({ clerkUserId: userId, email });
  const admin = isOperatorAdmin({ email: user.email ?? email, role: user.role });
  if (!admin) {
    return { signedIn: true, admin: false, session: null };
  }
  return {
    signedIn: true,
    admin: true,
    session: { clerkUserId: userId, email: user.email ?? email, user },
  };
}

export async function requireAdminPage(): Promise<AdminSession> {
  const { signedIn, admin, session } = await readAdminSession();
  if (!signedIn) {
    redirect("/login?redirect_url=/admin");
  }
  if (!admin || !session) {
    notFound();
  }
  return session;
}

export async function requireAdminApi(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: NextResponse }
> {
  const { signedIn, admin, session } = await readAdminSession();
  if (!signedIn || !admin || !session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found." }, { status: 404 }),
    };
  }
  return { ok: true, session };
}
