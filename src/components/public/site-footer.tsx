import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__main">
        <div>
          <Link className="brand" href="/" aria-label="PrimeView Realty home">
            PrimeView<span className="brand__accent">.</span>
            <span className="brand__realty">Realty</span>
          </Link>
          <p>Thoughtful moves. A better place to begin.</p>
        </div>
        <nav className="site-footer__links" aria-label="Footer navigation">
          <Link href="/properties">Properties</Link>
          <Link href="/#about">About us</Link>
          <Link href="/#contact">Contact</Link>
        </nav>
        <div id="contact" className="site-footer__contact">
          <span>Talk with our team</span>
          <Link href="/enquire">Send us an enquiry</Link>
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>© {new Date().getFullYear()} PrimeView Realty</span>
        <span>Serving home seekers across Nigeria</span>
      </div>
    </footer>
  );
}
