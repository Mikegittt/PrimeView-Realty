import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyPropertyFilters,
  filterProperties,
  normalizePropertyFilters,
  serializePropertyFilters,
} from "../src/lib/properties/filters.mjs";

const properties = [
  {
    id: "1",
    title: "Lekki apartment",
    location: "Lekki Phase 1, Lagos",
    purpose: "rent",
    property_type: "Apartment",
    bedrooms: 3,
  },
  {
    id: "2",
    title: "Ikoyi home",
    location: "Ikoyi, Lagos",
    purpose: "sale",
    property_type: "Detached house",
    bedrooms: 4,
  },
  {
    id: "3",
    title: "Lekki studio",
    location: "Lekki, Lagos",
    purpose: "rent",
    property_type: "Apartment",
    bedrooms: 1,
  },
  {
    id: "4",
    title: "Abuja flat",
    location: "Wuse 2, Abuja",
    purpose: "sale",
    property_type: "Apartment",
    bedrooms: null,
  },
];

function matchingIds(params) {
  return filterProperties(properties, normalizePropertyFilters(new URLSearchParams(params)))
    .map((property) => property.id);
}

test("FT-01: empty filters return all published property records", () => {
  assert.deepEqual(filterProperties(properties, emptyPropertyFilters), properties);
});

test("FT-02: rent selects rental properties only", () => {
  assert.deepEqual(matchingIds("purpose=rent"), ["1", "3"]);
});

test("FT-03: buy selects properties for sale only", () => {
  assert.deepEqual(matchingIds("purpose=sale"), ["2", "4"]);
});

test("FT-04: unmatched location returns no results", () => {
  assert.deepEqual(matchingIds("location=Atlantis"), []);
});

test("FT-05: 3+ bedrooms excludes under-count and unknown bedroom counts", () => {
  assert.deepEqual(matchingIds("bedrooms=3"), ["1", "2"]);
});

test("FT-06: location, purpose and property type combine with AND logic", () => {
  assert.deepEqual(
    matchingIds("location=Lekki&purpose=rent&type=Apartment"),
    ["1", "3"],
  );
  assert.deepEqual(
    matchingIds("location=Lekki&purpose=sale&type=Apartment"),
    [],
  );
});

test("FT-07: clearing filters serializes to an empty query and restores all", () => {
  const active = normalizePropertyFilters(
    new URLSearchParams("location=Ikoyi&purpose=sale&bedrooms=3"),
  );
  assert.equal(serializePropertyFilters(emptyPropertyFilters), "");
  assert.deepEqual(filterProperties(properties, emptyPropertyFilters), properties);
  assert.notDeepEqual(filterProperties(properties, active), properties);
});
