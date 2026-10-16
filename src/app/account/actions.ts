"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedProfile } from "@/lib/auth/server";
import { dashboardPathForRole } from "@/lib/auth/roles.mjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PasswordState = { error: string; success: string };

const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.");

export async function setPasswordAction(
  _previousState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/sign-in");

  const passwordValue = formData.get("password");
  const confirmValue = formData.get("confirmPassword");
  if (typeof passwordValue !== "string" || typeof confirmValue !== "string") {
    return { error: "Enter and confirm your password.", success: "" };
  }

  const parsed = passwordSchema.safeParse(passwordValue);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Choose a stronger password.", success: "" };
  }
  if (parsed.data !== confirmValue) {
    return { error: "The passwords do not match.", success: "" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    console.error("Could not set the invited user's password:", error.status ?? "unknown");
    return { error: "Password could not be updated. Please sign in again and retry.", success: "" };
  }

  redirect(dashboardPathForRole(profile.role));
}
