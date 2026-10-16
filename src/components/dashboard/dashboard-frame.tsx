import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import type { AuthenticatedProfile } from "@/lib/auth/server";

export function DashboardFrame({
  profile,
  title,
  children,
}: {
  profile: AuthenticatedProfile;
  title: string;
  children: React.ReactNode;
}) {
  const isAdmin = profile.role === "admin";

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link className="brand" href="/" aria-label="PrimeView Realty home">
          PrimeView<span className="brand__accent">.</span>
          <span className="brand__realty">Realty</span>
        </Link>
        <nav className="dashboard-nav" aria-label="Workspace navigation">
          {isAdmin ? (
            <>
              <Link href="/admin">Overview</Link>
              <Link href="/admin#reports-heading">Reports</Link>
              <Link href="/admin#properties-heading">Properties</Link>
              <Link href="/admin#leads-heading">Leads</Link>
              <Link href="/admin#activity-heading">Activity</Link>
            </>
          ) : (
            <>
              <Link href="/agent">Overview</Link>
              <Link href="/agent#reports-heading">Reports</Link>
              <Link href="/agent#properties-heading">Properties</Link>
              <Link href="/agent#leads-heading">Leads</Link>
              <Link href="/agent#activity-heading">Activity</Link>
            </>
          )}
        </nav>
        <div className="dashboard-header__user">
          <span>{profile.full_name || "Staff member"} <small>{isAdmin ? "Administrator" : "Agent"}</small></span>
          <form action={signOutAction}>
            <button className="button button--light" type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <section className="dashboard-main">
        <div className="dashboard-title-row">
          <div>
            <p className="eyebrow eyebrow--muted">{isAdmin ? "Agency workspace" : "Agent workspace"}</p>
            <h1>{title}</h1>
          </div>
          <Link className="text-link" href="/properties">View public listings <span aria-hidden="true">→</span></Link>
        </div>
        {children}
      </section>
    </main>
  );
}
