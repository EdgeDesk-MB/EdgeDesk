import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SetupPageClient } from "@/components/help/setup-page-client";

export default async function SetupPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");
  return <SetupPageClient />;
}
