"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedProfile } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeadStatus, PropertyStatus, UserRole } from "@/lib/supabase/database.types";

const leadStatuses: LeadStatus[] = [
  "New",
  "Contacted",
  "Viewing Scheduled",
  "Negotiation",
  "Closed",
  "Lost",
];
const propertyStatuses: PropertyStatus[] = ["draft", "published", "archived"];
const uuidSchema = z.string().uuid();
const optionalNumber = z
  .union([z.literal(""), z.string().regex(/^\d+(\.\d{1,2})?$/)])
  .transform((value) => value === "" ? null : Number(value));
const optionalInteger = z
  .union([z.literal(""), z.string().regex(/^\d+$/)])
  .transform((value) => value === "" ? null : Number(value))
  .refine((value) => value === null || value <= 32767);
const propertySchema = z.object({
  propertyId: z.union([z.literal(""), z.string().uuid()]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000),
  location: z.string().trim().min(1).max(300),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number),
  purpose: z.enum(["sale", "rent"]),
  propertyType: z.string().trim().min(1).max(100),
  bedrooms: optionalInteger,
  bathrooms: optionalInteger,
  area: optionalNumber,
  imageUrls: z.string().max(6000),
  status: z.enum(["draft", "published", "archived"]),
  assignedAgentId: z.union([z.literal(""), z.string().uuid()]),
}).refine((property) => property.price >= 0 && property.price <= 999999999999.99, {
  path: ["price"],
  message: "Enter a valid property price.",
}).refine((property) => property.area === null || property.area > 0, {
  path: ["area"],
  message: "Area must be greater than zero.",
});

function dashboardForRole(role: UserRole) {
  return role === "admin" ? "/admin" : "/agent";
}

export async function updateLeadAction(formData: FormData) {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/sign-in");

  const leadId = formData.get("leadId");
  const statusValue = formData.get("status");
  const status = typeof statusValue === "string"
    ? leadStatuses.find((candidate) => candidate === statusValue)
    : undefined;
  const assignedAgentId = formData.get("assignedAgentId");
  const redirectPath = dashboardForRole(profile.role);

  if (
    typeof leadId !== "string" ||
    !uuidSchema.safeParse(leadId).success ||
    !status ||
    (assignedAgentId !== null && typeof assignedAgentId !== "string")
  ) {
    redirect(`${redirectPath}?notice=invalid-update`);
  }

  if (profile.role !== "admin" && assignedAgentId !== null) {
    redirect("/access-denied");
  }
  if (typeof assignedAgentId === "string" && assignedAgentId !== "" && !uuidSchema.safeParse(assignedAgentId).success) {
    redirect(`${redirectPath}?notice=invalid-update`);
  }

  const updates: { status: LeadStatus; assigned_agent_id?: string | null } = {
    status,
  };
  if (profile.role === "admin") {
    updates.assigned_agent_id =
      typeof assignedAgentId === "string" && assignedAgentId ? assignedAgentId : null;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (error) {
    console.error("Could not update lead through the user's authorized session:", error.code);
    redirect(`${redirectPath}?notice=update-failed`);
  }

  revalidatePath("/agent");
  revalidatePath("/admin");
  redirect(`${redirectPath}?notice=lead-updated`);
}

export async function updatePropertyStatusAction(formData: FormData) {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/sign-in");

  const propertyId = formData.get("propertyId");
  const statusValue = formData.get("status");
  const status = typeof statusValue === "string"
    ? propertyStatuses.find((candidate) => candidate === statusValue)
    : undefined;
  const redirectPath = dashboardForRole(profile.role);

  if (
    typeof propertyId !== "string" ||
    !uuidSchema.safeParse(propertyId).success ||
    !status
  ) {
    redirect(`${redirectPath}?notice=invalid-update`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("properties")
    .update({ status })
    .eq("id", propertyId);

  if (error) {
    console.error("Could not update property through the user's authorized session:", error.code);
    redirect(`${redirectPath}?notice=update-failed`);
  }

  revalidatePath("/agent");
  revalidatePath("/admin");
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  redirect(`${redirectPath}?notice=property-updated`);
}

export async function savePropertyAction(formData: FormData) {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/sign-in");

  const rawData = {
    propertyId: formData.get("propertyId"),
    title: formData.get("title"),
    description: formData.get("description"),
    location: formData.get("location"),
    price: formData.get("price"),
    purpose: formData.get("purpose"),
    propertyType: formData.get("propertyType"),
    bedrooms: formData.get("bedrooms") ?? "",
    bathrooms: formData.get("bathrooms") ?? "",
    area: formData.get("area") ?? "",
    imageUrls: formData.get("imageUrls"),
    status: formData.get("status"),
    assignedAgentId: formData.get("assignedAgentId") ?? "",
  };
  const parsed = propertySchema.safeParse(rawData);
  const redirectPath = dashboardForRole(profile.role);
  if (!parsed.success) redirect(`${redirectPath}?notice=invalid-property`);
  if (profile.role === "agent" && parsed.data.assignedAgentId && parsed.data.assignedAgentId !== profile.id) {
    redirect("/access-denied");
  }

  const imageUrls = parsed.data.imageUrls
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    imageUrls.length > 30 ||
    imageUrls.some((value) => {
      try {
        const url = new URL(value);
        return url.protocol !== "https:";
      } catch {
        return true;
      }
    })
  ) {
    redirect(`${redirectPath}?notice=invalid-property`);
  }

  const assignedAgentId = profile.role === "agent"
    ? profile.id
    : parsed.data.assignedAgentId || null;
  const supabase = await createSupabaseServerClient();
  const values = {
    title: parsed.data.title,
    description: parsed.data.description,
    location: parsed.data.location,
    price: parsed.data.price,
    purpose: parsed.data.purpose,
    property_type: parsed.data.propertyType,
    bedrooms: parsed.data.bedrooms,
    bathrooms: parsed.data.bathrooms,
    area: parsed.data.area,
    image_urls: imageUrls,
    status: parsed.data.status,
    assigned_agent_id: assignedAgentId,
  };

  const result = parsed.data.propertyId
    ? await supabase
      .from("properties")
      .update(values)
      .eq("id", parsed.data.propertyId)
      .select("id")
      .maybeSingle()
    : await supabase
      .from("properties")
      .insert(values)
      .select("id")
      .single();

  if (result.error || !result.data) {
    console.error("Could not save property through the authorized session:", result.error?.code ?? "no_record");
    redirect(`${redirectPath}?notice=property-save-failed`);
  }

  revalidatePath("/admin");
  revalidatePath("/agent");
  revalidatePath("/properties");
  revalidatePath(`/properties/${result.data.id}`);
  redirect(`${redirectPath}?notice=property-saved`);
}

export async function updateStaffRoleAction(formData: FormData) {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "admin") redirect("/access-denied");

  const userId = formData.get("userId");
  const roleValue = formData.get("role");
  const role = roleValue === "admin" || roleValue === "agent" ? roleValue : null;

  if (
    typeof userId !== "string" ||
    !uuidSchema.safeParse(userId).success ||
    !role
  ) {
    redirect("/admin?notice=invalid-update");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_profile_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) {
    console.error("Could not update staff role using the administrator RPC:", error.code);
    redirect(`/admin?notice=${error.code === "23514" ? "last-admin" : "update-failed"}`);
  }

  revalidatePath("/admin");
  redirect("/admin?notice=role-updated");
}

export async function recordLeadFollowUpAction(formData: FormData) {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/sign-in");

  const leadId = formData.get("leadId");
  const descriptionValue = formData.get("description");
  const redirectPath = dashboardForRole(profile.role);

  if (
    typeof leadId !== "string" ||
    !uuidSchema.safeParse(leadId).success ||
    typeof descriptionValue !== "string" ||
    descriptionValue.trim().length < 1 ||
    descriptionValue.trim().length > 500
  ) {
    redirect(`${redirectPath}?notice=invalid-update`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_lead_follow_up", {
    p_lead_id: leadId,
    p_description: descriptionValue.trim(),
  });
  if (error) {
    console.error("Could not record lead follow-up through the authorized RPC:", error.code);
    redirect(`${redirectPath}?notice=update-failed`);
  }

  revalidatePath("/agent");
  revalidatePath("/admin");
  redirect(`${redirectPath}?notice=follow-up-recorded`);
}

export type InviteState = { error: string; success: string };

export async function inviteStaffAction(
  _previousState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "admin") redirect("/access-denied");

  const emailValue = formData.get("email");
  const nameValue = formData.get("fullName");
  const roleValue = formData.get("role");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const fullName = typeof nameValue === "string" ? nameValue.trim() : "";
  const role = roleValue === "admin" ? "admin" : roleValue === "agent" ? "agent" : null;

  if (!z.email().safeParse(email).success || email.length > 254) {
    return { error: "Enter a valid email address.", success: "" };
  }
  if (!fullName || fullName.length > 120) {
    return { error: "Enter a name of 1 to 120 characters.", success: "" };
  }
  if (!role) {
    return { error: "Choose a valid staff role.", success: "" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  let redirectTo: string;
  try {
    if (!siteUrl) throw new Error("Missing site URL");
    const parsedSiteUrl = new URL(siteUrl);
    if (parsedSiteUrl.protocol !== "https:" && parsedSiteUrl.hostname !== "localhost") {
      throw new Error("Site URL must use HTTPS");
    }
    redirectTo = new URL("/account/set-password", parsedSiteUrl).toString();
  } catch {
    console.error("Staff invitation requires a valid NEXT_PUBLIC_SITE_URL.");
    return { error: "Invitation service is not configured. Contact the deployment administrator.", success: "" };
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });

  if (error || !data.user) {
    console.error("Could not create staff invitation:", error?.status ?? "missing_user");
    return {
      error: "Invitation could not be created. Check whether the address already belongs to an account.",
      success: "",
    };
  }

  if (role === "admin") {
    const { error: roleError } = await supabase.rpc("set_profile_role", {
      p_user_id: data.user.id,
      p_role: "admin",
    });

    if (roleError) {
      console.error("Staff invitation succeeded but role assignment did not:", roleError.code);
      return {
        error: "The invitation was sent, but administrator access was not assigned. The account remains an agent; contact support before resending.",
        success: "",
      };
    }
  }

  return { error: "", success: `Invitation sent to ${email} as ${role}.` };
}
