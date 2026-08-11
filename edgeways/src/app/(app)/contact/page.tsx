import { redirect } from "next/navigation";

/** Legacy path: Feedback replaced Contact us. */
export default function ContactRedirectPage() {
  redirect("/feedback");
}
