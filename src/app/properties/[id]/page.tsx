import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PropertyImage } from "@/components/public/property-image";
import { formatPropertyPrice } from "@/components/public/property-card";
import { getPublishedProperty } from "@/lib/properties/data";

type PropertyPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PropertyDetailPage({ params }: PropertyPageProps) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { property, error } = await getPublishedProperty(id);
  if (error) {
    return (
      <>
        <SiteHeader />
        <main className="detail-error">
          <div className="empty-state empty-state--error" role="alert">
            <h1>Property details are unavailable.</h1>
            <p>{error} Please try again shortly.</p>
            <Link className="text-link" href="/properties">Back to properties →</Link>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }
  if (!property) notFound();

  return (
    <>
      <SiteHeader />
      <main className="detail-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span>
          <Link href="/properties">Properties</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{property.title}</span>
        </nav>
        <section className="detail-hero">
          <div className="detail-hero__image">
            <PropertyImage
              src={property.image_urls[0]}
              alt={`${property.property_type} in ${property.location}`}
              priority
              className="detail-hero__photo"
            />
            <span className="property-card__badge">
              {property.purpose === "rent" ? "For rent" : "For sale"}
            </span>
          </div>
          <div className="detail-summary">
            <p className="eyebrow eyebrow--muted">{property.location}</p>
            <h1>{property.title}</h1>
            <p className="detail-summary__price">
              {formatPropertyPrice(property.price, property.purpose)}
            </p>
            <div className="detail-facts">
              <span>{property.property_type}</span>
              {property.bedrooms !== null && <span>{property.bedrooms} bedrooms</span>}
              {property.bathrooms !== null && <span>{property.bathrooms} bathrooms</span>}
              {property.area !== null && <span>{property.area} area</span>}
            </div>
            <Link
              className="button button--navy detail-summary__cta"
              href={`/enquire?propertyId=${encodeURIComponent(property.id)}`}
            >
              Enquire about this property <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
        <section className="detail-description" aria-labelledby="description-title">
          <div>
            <p className="eyebrow eyebrow--muted">The property</p>
            <h2 id="description-title">A closer look.</h2>
          </div>
          <p>{property.description || "Contact our team to learn more about this property."}</p>
        </section>
        <section className="detail-contact">
          <div>
            <p className="eyebrow">Have a question?</p>
            <h2>We&apos;re here to help you make your move.</h2>
          </div>
          <Link
            className="button button--light"
            href={`/enquire?propertyId=${encodeURIComponent(property.id)}`}
          >
            Send an enquiry <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
