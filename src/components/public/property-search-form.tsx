import type { PropertyFilters } from "@/lib/properties/filters.mjs";

const propertyTypes = [
  "Apartment",
  "Detached house",
  "Duplex",
  "Land",
  "Townhouse",
  "Commercial",
];

export function PropertySearchForm({
  filters,
  action = "/properties",
  compact = false,
}: {
  filters?: PropertyFilters;
  action?: string;
  compact?: boolean;
}) {
  return (
    <form
      className={`search-form${compact ? " search-form--compact" : ""}`}
      action={action}
      method="get"
      aria-label="Search properties"
    >
      <label className="search-field">
        <span>Location</span>
        <input
          name="location"
          type="search"
          placeholder="e.g. Lekki, Lagos"
          defaultValue={filters?.location}
        />
      </label>
      <label className="search-field">
        <span>Looking to</span>
        <select name="purpose" defaultValue={filters?.purpose ?? ""}>
          <option value="">Buy or rent</option>
          <option value="sale">Buy</option>
          <option value="rent">Rent</option>
        </select>
      </label>
      <label className="search-field">
        <span>Property type</span>
        <input
          name="type"
          list="property-types"
          placeholder="Any type"
          defaultValue={filters?.propertyType ?? ""}
        />
        <datalist id="property-types">
          {propertyTypes.map((type) => <option key={type} value={type} />)}
        </datalist>
      </label>
      <label className="search-field">
        <span>Bedrooms</span>
        <select
          name="bedrooms"
          defaultValue={filters?.bedrooms ? String(filters.bedrooms) : ""}
        >
          <option value="">Any</option>
          <option value="3">3+ bedrooms</option>
        </select>
      </label>
      <button className="button button--navy search-form__submit" type="submit">
        Search homes <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
