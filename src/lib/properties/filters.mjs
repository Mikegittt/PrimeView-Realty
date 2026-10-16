/** @typedef {import("../supabase/database.types").Property} Property */
/** @typedef {"" | "sale" | "rent"} Purpose */
/** @typedef {{ location: string, purpose: Purpose, propertyType: string, bedrooms: 0 | 3 }} PropertyFilters */

/** @type {PropertyFilters} */
export const emptyPropertyFilters = {
  location: "",
  purpose: "",
  propertyType: "",
  bedrooms: 0,
};

/**
 * @param {URLSearchParams} params
 * @returns {PropertyFilters}
 */
export function normalizePropertyFilters(params) {
  const purpose = params.get("purpose");
  const bedrooms = params.get("bedrooms");

  return {
    location: (params.get("location") ?? "").trim().slice(0, 100),
    purpose: purpose === "sale" || purpose === "rent" ? purpose : "",
    propertyType: (params.get("type") ?? "").trim().slice(0, 100),
    bedrooms: bedrooms === "3" ? 3 : 0,
  };
}

/**
 * @param {Property[]} properties
 * @param {PropertyFilters} filters
 */
export function filterProperties(properties, filters) {
  const location = filters.location.toLowerCase();
  const propertyType = filters.propertyType.toLowerCase();

  return properties.filter((property) => {
    return (
      (!location ||
        property.location.toLowerCase().includes(location)) &&
      (!filters.purpose || property.purpose === filters.purpose) &&
      (!propertyType ||
        property.property_type.toLowerCase() === propertyType) &&
      (filters.bedrooms === 0 ||
        (property.bedrooms !== null && property.bedrooms >= filters.bedrooms))
    );
  });
}

/**
 * @param {PropertyFilters} filters
 */
export function serializePropertyFilters(filters) {
  const params = new URLSearchParams();
  if (filters.location) params.set("location", filters.location);
  if (filters.purpose) params.set("purpose", filters.purpose);
  if (filters.propertyType) params.set("type", filters.propertyType);
  if (filters.bedrooms) params.set("bedrooms", String(filters.bedrooms));
  return params.toString();
}
