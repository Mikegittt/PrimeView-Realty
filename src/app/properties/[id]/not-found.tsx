import Link from "next/link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

export default function PropertyNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="detail-error">
        <section className="empty-state">
          <p className="eyebrow eyebrow--muted">PrimeView properties</p>
          <h1>This home is no longer available.</h1>
          <p>
            It may have been archived or the address may be incorrect. Explore
            our current collection to find another place.
          </p>
          <Link className="button button--navy" href="/properties">
            Browse properties <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
