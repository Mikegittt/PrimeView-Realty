import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/database.types";

export type AuthenticatedProfile = {
  id: string;
  full_name: string;
  role: UserRole;
};

export async function getAuthenticatedProfile(): Promise<AuthenticatedProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not load the authenticated user's profile (${profileError.code}).`);
  }

  return profile;
}

export async function requireRole(
  requiredRole: UserRole,
  protectedPath: string,
): Promise<AuthenticatedProfile> {
  const profile = await getAuthenticatedProfile();

  if (!profile) {
    redirect(`/sign-in?next=${encodeURIComponent(protectedPath)}`);
  }

  if (profile.role !== requiredRole) {
    redirect("/access-denied");
  }

  return profile;
}
