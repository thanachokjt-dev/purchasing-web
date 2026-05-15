import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { defaultLandingForUser } from "@/lib/role-nav";

export default async function HomePage() {
  const profile = await requireUser("/");
  redirect(defaultLandingForUser(profile));
}
