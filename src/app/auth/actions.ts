"use server";

import { redirect } from "next/navigation";
import { dashboardPathForRole } from "@/lib/auth/roles.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = {
  error: string;
};

export async function signInAction(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email || !password || email.length > 254 || password.length > 1024) {
    return { error: "Enter a valid email address and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return { error: "Sign-in failed. Check your details or ask an administrator for an invitation." };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    await supabase.auth.signOut();
    return { error: "Your session could not be verified. Please try signing in again." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    console.error("Could not resolve the signed-in user's profile:", profileError?.code ?? "missing_profile");
    return { error: "Your staff profile is unavailable. Contact an administrator." };
  }

  redirect(dashboardPathForRole(profile.role));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Could not revoke the current Supabase session:", error.code);
    redirect("/sign-in?error=sign-out");
  }

  redirect("/sign-in?signedOut=1");
}
