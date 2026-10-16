import type { Metadata } from "next";
import Link from "next/link";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { PropertyImage } from "@/components/public/property-image";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { formatPropertyPrice } from "@/components/public/property-card";
import { getPublishedProperty } from "@/lib/properties/data";

export const metadata: Metadata = {
  title: "Make an enquiry",
};

type EnquiryPageProps = {
  searchParams: Promise<{ propertyId?: string }>;
};

export default async function EnquiryPage({ searchParams }: EnquiryPageProps) {
  const { propertyId } = await searchParams;
  const validId = propertyId && /^[0-9a-f-]{36}$/i.test(propertyId) ? propertyId : null;
  const propertyResult = validId ? await getPublishedProperty(validId) : null;
  const property = propertyResult?.property ?? null;
  const loadError = propertyResult?.error ?? null;

  return (
    <>
      <SiteHeader />
      <main className="enquiry-page">
        <div className="enquiry-page__intro">
          <p className="eyebrow eyebrow--muted">We&apos;re here to help</p>
          <h1>Start a conversation.</h1>
          <p>Tell us a little about what you&apos;re looking for. Our team will be in touch.</p>
        </div>
        <div className="enquiry-layout">
          <section className="enquiry-panel" aria-labelledby="enquiry-title">
            <h2 id="enquiry-title">Your enquiry</h2>
            <EnquiryForm propertyId={validId} />
          </section>
          <aside className="enquiry-aside">
            {loadError ? (
              <div className="notice notice--error" role="alert">
                Property details could not be loaded. Your enquiry can still be
                submitted, but it will not be linked to a listing.
              </div>
            ) : property ? (
              <article className="enquiry-property">
                <div className="enquiry-property__image">
                  <PropertyImage
                    src={property.image_urls[0]}
                    alt={`${property.property_type} in ${property.location}`}
                  />
                </div>
                <div className="enquiry-property__body">
                  <p className="eyebrow eyebrow--muted">Enquiring about</p>
                  <h2>{property.title}</h2>
                  <p>{property.location}</p>
                  <strong>{formatPropertyPrice(property.price, property.purpose)}</strong>
                  <Link className="text-link" href={`/properties/${property.id}`}>
                    View property details <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ) : (
              <div className="enquiry-aside__note">
                <h2>Looking for a home?</h2>
                <p>Tell us what matters to you and we&apos;ll help you explore your options.</p>
                <Link className="text-link" href="/properties">
                  Browse properties <span aria-hidden="true">→</span>
                </Link>
              </div>
            )}
            <div className="enquiry-aside__contact">
              <p className="eyebrow eyebrow--muted">Prefer a direct conversation?</p>
              <Link href="/#contact">Contact PrimeView Realty</Link>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
