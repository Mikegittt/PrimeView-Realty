import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/supabase/database.types";
import type { PropertyFilters } from "./filters.mjs";

const pageSize = 12;

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function getPublishedProperties(options?: {
  filters?: PropertyFilters;
  page?: number;
  limit?: number;
}) {
  try {
    const supabase = await createSupabaseServerClient();
    const limit = options?.limit ?? pageSize;
    const page = Math.max(1, options?.page ?? 1);
    let query = supabase
      .from("properties")
      .select("*", { count: "exact" })
      .eq("status", "published")
      .order("created_at", { ascending: false });

    const filters = options?.filters;
    if (filters?.location) {
      query = query.ilike("location", `%${escapeLikePattern(filters.location)}%`);
    }
    if (filters?.purpose) {
      query = query.eq("purpose", filters.purpose);
    }
    if (filters?.propertyType) {
      query = query.ilike("property_type", filters.propertyType);
    }
    if (filters?.bedrooms) {
      query = query.gte("bedrooms", filters.bedrooms);
    }

    const { data, count, error } = await query.range(
      (page - 1) * limit,
      page * limit - 1,
    );

    if (error) {
      console.error("Could not load published properties:", error.message);
      return { properties: null, count: 0, error: "Properties could not be loaded right now." };
    }

    return {
      properties: data as Property[],
      count: count ?? 0,
      error: null,
    };
  } catch (error) {
    console.error("Could not connect to the property service:", error);
    return {
      properties: null,
      count: 0,
      error: "Property search is temporarily unavailable.",
    };
  }
}

export async function getPublishedProperty(id: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("Could not load property details:", error.message);
      return { property: null, error: "Property details are temporarily unavailable." };
    }

    return { property: data as Property | null, error: null };
  } catch (error) {
    console.error("Could not connect to the property service:", error);
    return {
      property: null,
      error: "Property details are temporarily unavailable.",
    };
  }
}
