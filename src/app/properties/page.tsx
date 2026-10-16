import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PropertyCard } from "@/components/public/property-card";
import { PropertySearchForm } from "@/components/public/property-search-form";
import {
  normalizePropertyFilters,
  serializePropertyFilters,
} from "@/lib/properties/filters.mjs";
import { getPublishedProperties } from "@/lib/properties/data";

export const metadata: Metadata = {
  title: "Properties",
  description: "Browse homes for sale and rent with PrimeView Realty.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") urlParams.set(key, value);
  }

  const filters = normalizePropertyFilters(urlParams);
  const pageValue = Number.parseInt(urlParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageValue) ? Math.max(1, pageValue) : 1;
  const pageSize = 12;
  const result = await getPublishedProperties({ filters, page, limit: pageSize });
  const totalPages = Math.ceil(result.count / pageSize);
  const filterQuery = serializePropertyFilters(filters);

  function pageHref(targetPage: number) {
    const nextParams = new URLSearchParams(filterQuery);
    nextParams.set("page", String(targetPage));
    return `/properties?${nextParams.toString()}`;
  }

  return (
    <>
      <SiteHeader />
      <main className="listing-page">
        <section className="listing-intro">
          <p className="eyebrow eyebrow--muted">The PrimeView collection</p>
          <h1>Find your next place.</h1>
          <p>Explore considered homes for sale and rent across Nigeria.</p>
        </section>

        <section className="listing-search" aria-label="Property filters">
          <PropertySearchForm filters={filters} />
          {filterQuery && (
            <Link className="clear-filters" href="/properties">
              Clear all filters
            </Link>
          )}
        </section>

        <section className="listing-results" aria-labelledby="results-heading">
          <div className="listing-results__heading">
            <h2 id="results-heading">
              {result.error
                ? "Property search"
                : `${result.count} ${result.count === 1 ? "property" : "properties"}`}
            </h2>
            {page > 1 && !result.error && (
              <span>Page {page} of {totalPages}</span>
            )}
          </div>

          {result.error ? (
            <div className="empty-state empty-state--error" role="alert">
              <h3>We couldn&apos;t load properties.</h3>
              <p>{result.error} Please try again in a moment.</p>
              <Link className="text-link" href="/properties">
                Try property search again <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : result.properties?.length ? (
            <>
              <div className="property-grid">
                {result.properties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
              <nav className="pagination" aria-label="Property result pages">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)}>← Previous</Link>
                ) : <span aria-hidden="true" />}
                <span>Page {page} of {totalPages}</span>
                {page < totalPages ? (
                  <Link href={pageHref(page + 1)}>Next →</Link>
                ) : <span aria-hidden="true" />}
              </nav>
            </>
          ) : (
            <div className="empty-state">
              <p className="eyebrow eyebrow--muted">No exact matches</p>
              <h3>Let&apos;s broaden the search.</h3>
              <p>
                Try another location or remove one or more filters to see more
                available homes.
              </p>
              {filterQuery && (
                <Link className="button button--navy" href="/properties">
                  Clear filters <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
