import Link from "next/link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PropertyCard } from "@/components/public/property-card";
import { PropertySearchForm } from "@/components/public/property-search-form";
import { getPublishedProperties } from "@/lib/properties/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { properties, error } = await getPublishedProperties({ limit: 3 });

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero__image" role="img" aria-label="Contemporary residence framed by mature tropical landscaping" />
          <div className="hero__content">
            <p className="eyebrow">A better way to find your place</p>
            <h1>Find a place to call your own.</h1>
            <p className="hero__description">
              Thoughtfully selected homes and trusted local guidance for your
              next move in Nigeria.
            </p>
          </div>
          <div className="hero-search">
            <PropertySearchForm compact />
          </div>
          <p className="hero__caption">Your next chapter starts here</p>
        </section>

        <section className="section featured" aria-labelledby="featured-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow--muted">A considered collection</p>
              <h2 id="featured-title">Featured properties</h2>
            </div>
            <Link className="text-link" href="/properties">
              Explore all properties <span aria-hidden="true">→</span>
            </Link>
          </div>

          {error ? (
            <p className="notice notice--error" role="status">{error}</p>
          ) : properties?.length ? (
            <div className="property-grid property-grid--featured">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>New homes are on the way.</h3>
              <p>Our collection is being prepared. Please check back soon.</p>
              <Link className="text-link" href="/properties">
                Browse property search <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </section>

        <section className="about-section" id="about" aria-labelledby="about-title">
          <div className="about-section__image" role="img" aria-label="Welcoming modern home with a shaded outdoor terrace" />
          <div className="about-section__content">
            <p className="eyebrow eyebrow--muted">Rooted in local knowledge</p>
            <h2 id="about-title">Good decisions begin with good people.</h2>
            <p>
              Finding the right home takes more than a listing. We bring
              thoughtful advice, attentive service and a clear view of the
              local market to every conversation.
            </p>
            <a className="text-link" href="#contact">
              Get to know our team <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>

        <section className="contact-band">
          <div>
            <p className="eyebrow">Your next move, made clearer</p>
            <h2>Let&apos;s find your place.</h2>
          </div>
          <Link className="button button--light" href="/enquire">
            Speak with our team <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
