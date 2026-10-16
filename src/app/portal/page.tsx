import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/auth/server";
import { dashboardPathForRole } from "@/lib/auth/roles.mjs";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/sign-in?next=%2Fportal");
  redirect(dashboardPathForRole(profile.role));
}
