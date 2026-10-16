import type { Property } from "../supabase/database.types";

export type PropertyFilters = {
  location: string;
  purpose: "" | "sale" | "rent";
  propertyType: string;
  bedrooms: 0 | 3;
};

export const emptyPropertyFilters: PropertyFilters;
export function normalizePropertyFilters(params: URLSearchParams): PropertyFilters;
export function filterProperties(
  properties: Property[],
  filters: PropertyFilters,
): Property[];
export function serializePropertyFilters(filters: PropertyFilters): string;
