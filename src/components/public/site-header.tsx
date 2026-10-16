import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="PrimeView Realty home">
        PrimeView<span className="brand__accent">.</span>
        <span className="brand__realty">Realty</span>
      </Link>
      <nav className="site-nav" aria-label="Main navigation">
        <Link className="site-nav__property-link" href="/properties">Properties</Link>
        <Link href="/#about">About</Link>
        <Link className="site-nav__contact" href="/#contact">
          Contact
        </Link>
        <Link className="site-nav__staff-link" href="/sign-in">Sign in</Link>
        <Link className="site-nav__staff-link" href="/portal">Agent portal</Link>
        <Link className="button button--navy site-nav__cta" href="/properties">
          Find a home
        </Link>
      </nav>
    </header>
  );
}
