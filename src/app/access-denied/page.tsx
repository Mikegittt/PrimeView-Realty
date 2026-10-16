import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";

export default function AccessDeniedPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="access-denied-title">
        <p className="eyebrow eyebrow--muted">Access restricted</p>
        <h1 id="access-denied-title">This area isn&apos;t available to your account.</h1>
        <p>
          Your signed-in role does not have permission to open this page. Ask an
          administrator if you believe you need access.
        </p>
        <div className="auth-actions">
          <Link className="button button--navy" href="/portal">Go to my portal</Link>
          <form action={signOutAction}>
            <button className="button button--light" type="submit">Sign out</button>
          </form>
        </div>
      </section>
    </main>
  );
}
