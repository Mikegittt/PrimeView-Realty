# PrimeView Realty

PrimeView Realty is a web-based property listing and client lead management
system for Nigerian real estate agencies.

## Stack

- Next.js App Router and React
- TypeScript with strict checking
- Tailwind CSS
- Supabase PostgreSQL and Auth integration foundation (`@supabase/ssr`)
- npm

## Getting started

```bash
npm install
Copy-Item .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
`.env.local` using values from your Supabase project. The example file contains
placeholders, not credentials. Do not put a service-role key in client code or
expose it through a `NEXT_PUBLIC_` variable.

Start the development server with `npm run dev`, then open
http://localhost:3000.

## Application layout

```text
src/
  app/properties/      Published listing search and property detail routes
  app/api/enquiries/    Server-side public enquiry endpoint
  app/enquire/          Property-aware enquiry form
  app/sign-in/          Staff sign-in
  app/agent/            Agent-only workspace
  app/admin/            Administrator-only workspace
  app/leads/[id]/       Role-protected lead detail and activity
  app/auth/             Session sign-in and sign-out actions
  app/account/          Invitation password setup
  app/portal/           Role-based dashboard entry route
  components/public/    Shared navigation, property cards, filters and forms
  components/auth/      Sign-in, invitation and password forms
  components/dashboard/ Agent and administrator workspace panels
  lib/auth/             Server-side identity and role guards
  lib/enquiries/        Shared enquiry validation and Nigerian phone normalization
  lib/properties/       Public property data access and filter behavior
  lib/supabase/         Typed browser, server, and server-only admin clients
  proxy.ts              Refreshes Supabase auth cookies
supabase/migrations/    Database schema, RLS, audit, and enquiry idempotency migrations
tests/                  Focused filter and enquiry validation/integration tests
```

## Supabase setup

Copy `.env.example` to `.env.local` and replace every placeholder with values
from your Supabase project. The service-role key and rate-limit secret are
server-only; never prefix them with `NEXT_PUBLIC_`, expose them to browser
code, or commit real values.

Set `NEXT_PUBLIC_SITE_URL` to the HTTPS origin of the deployed website (use
`http://localhost:3000` for local development). Supabase Auth's redirect URL
allow-list must include `/account/set-password` for that origin. Disable
public self-registration in Supabase Auth; staff accounts are invitation-only.

Apply the migrations in `supabase/migrations/` using the Supabase CLI
(`supabase link` followed by `supabase db push`) or the Supabase SQL Editor.
The migration creates agent profiles for existing Auth users and defaults new
profiles to `agent`. Promote the first administrator
from a trusted SQL session only after creating that user's Auth account. This
one-time bootstrap is deliberately not exposed through a public route:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'your-admin-email@example.com'
);
```

Review that exactly one intended profile was updated. There is no public
registration or client-side role-promotion path. There is no default
administrator credential.

### Sign-in and role access

Staff sign in at `/sign-in` with a Supabase Auth password account. New accounts
are invited by an administrator from `/admin`; the invitation redirects to
`/account/set-password`, where the invited user creates a password using
Supabase Auth. Passwords are never stored or checked by the application.
`/portal` resolves the staff destination from the database profile role:
administrators go to `/admin` and agents go to `/agent`. Unauthenticated users
are redirected to sign in, while the wrong signed-in role sees an access-denied
page. Sign out revokes the current Supabase session.

The Next.js 16 proxy refreshes auth cookies, but does not grant access by
itself. Server pages and every dashboard server action verify the current
Supabase user and load the role from `profiles`; role or assignment values
submitted by a browser are never treated as authority. Dashboard reads and
mutations use the cookie-bound Supabase client, so PostgreSQL RLS and grants
are enforced on every operation. The service-role client is used only for the
administrator-only invitation email API. Agent assignments, administrator
role changes, and protected audit visibility are further restricted by the
existing database policies and the staff-role migration. The database also
prevents demoting the final administrator, including concurrent role changes.

Invite an agent or administrator from the protected admin workspace. An
invitation always creates the database-default `agent` profile; promotion to
administrator uses the authenticated administrator-only
`set_profile_role` function. Existing staff roles can be changed only through
that same function. If email invitation succeeds but role assignment fails,
the new account remains an agent and the UI reports the partial failure.

The enquiry endpoint requires a deployment proxy that sets/overwrites
`x-real-ip` with the connecting client's IP. It HMAC-hashes that address using
`ENQUIRY_RATE_LIMIT_SECRET` before applying a database-backed limit of five
new submissions per 15-minute window. Generate a unique secret with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
and set it in the server environment. The endpoint also validates a honeypot
field and bounds request size. The supported phone policy accepts Nigerian
mobile numbers in local `08031234567` or international `+2348031234567` form,
with optional spaces, parentheses, or hyphens; accepted numbers are stored in
normalized `+234` format.

Enquiry requests carry a UUID idempotency key. The database serializes requests
with the same key and IP hash: a repeated request with the same payload returns
the existing lead, while reusing the key for a different payload returns a
conflict. A new key creates a separate enquiry, even for the same client and
message. The form disables its submit button while sending and retains the key
after recoverable errors so a retry cannot accidentally create a duplicate.
The database ledger expires after 24 hours. Only the server-side function can
insert public enquiries; anonymous clients still cannot read leads.

The endpoint requires a deployment proxy that sets/overwrites `x-real-ip` with
the connecting client's IP. If your hosting provider does not provide a
trusted `x-real-ip` header, configure this at the trusted reverse proxy; do
not substitute a caller-controlled forwarded header. The endpoint uses the
server-only service-role client to call database functions that are not
executable by anonymous or authenticated browser roles. Configure
`SUPABASE_SERVICE_ROLE_KEY` and `ENQUIRY_RATE_LIMIT_SECRET` only in server
environments, never in browser code or `NEXT_PUBLIC_` variables.

### Verify enquiry persistence

All four ordered migrations in `supabase/migrations/` must be applied. With
the Supabase CLI, link the intended project and run `supabase db push`; in the
SQL Editor, apply the database foundation first,
`20261016000100_idempotent_public_enquiries.sql` second, and
`20261016000200_secure_staff_role_management.sql` third, then
`20261016000300_dashboard_reports_and_audit.sql`.

Run validation and all local tests using `npm test`. The real database
integration test is opt-in and requires an applied schema plus
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the test process:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-server-only-service-role-key"
node --test tests/enquiry-persistence.integration.test.mjs
```

It creates a temporary published test property, sends the same request key
concurrently twice, verifies both responses reference one persisted lead and
that the lead has status `New`, the correct property ID and a timestamp, then
uses a fresh key to verify a separate enquiry is saved. It removes test leads,
activity records and the temporary property afterward. Do not set these
variables to production credentials; use a disposable Supabase project.

To manually verify the live HTTP path, configure `.env.local` and the trusted
proxy IP header, run `npm run dev`, and submit the form twice quickly. The
button is disabled while the first request is in flight; after a successful
response the form confirms that the backend saved the lead. Verify database
persistence in the SQL Editor without selecting client contact details:

```sql
select id, status, property_id, created_at
from public.leads
order by created_at desc
limit 10;
```

With a configured project, also submit six new requests from one test IP in a
15-minute window to verify that the sixth is rate-limited. A retry of an
already-persisted idempotency key does not consume another quota slot.

Auth cookies are refreshed in the Next.js 16 `src/proxy.ts`; the server client
uses the current async `cookies()` API. Auth integration, invitation delivery,
and RLS behavior still require verification against a configured Supabase
project.

Agents can change pipeline stages and record follow-up notes only on assigned
leads; administrators can view and assign leads, manage listing status, review
activity history, invite staff, and change staff roles. Database triggers and
security-definer RPCs validate agent assignments and follow-up ownership, and
record activity with the authenticated actor. The browser cannot directly
insert or edit audit records.

The agency dashboard provides published listing, lead and pipeline totals
from `get_dashboard_metrics`; filters affect the visible lead list, not report
totals. Administrators see agency totals, all pipeline stages, per-agent
results and unassigned leads. Agents see only leads, properties and activity
permitted by their assignments. Closed and Lost are counted as separate
outcomes. Lead lists are searchable by client name, filterable by stage, and
paginated; contact information and lead detail routes require a staff session
with the matching RLS assignment. Listing edits, drafts, publication and
archive status use the authenticated user's database session. Archiving asks
for confirmation before submission; database policy ensures only the assigned
agent or an administrator can persist a change.

No remote Supabase project or credentials are configured in this workspace.
After applying the migration, verify the policy matrix with an anonymous
client, two agent users, and an administrator: anonymous reads should return
published properties only; anonymous lead/profile/activity reads and direct
lead inserts should fail; agents should see only assigned leads and related
activity; administrators should manage agency records; and ordinary users
should not be able to change their role. Also submit six enquiries from one
trusted test IP to confirm the sixth is rate-limited.

Public property browsing, property details and enquiries use records returned
by Supabase; there are no seeded or hard-coded sample listings. The listing
page filters and paginates on the server. The agent and administrator
dashboards provide persisted property editing and publication workflows,
searchable/paginated lead management, lead details, follow-up activity, and
role-scoped reporting. Listings and leads are each paginated in the dashboard;
lead filters are retained while navigating between listing pages.

Property filter tests cover FT-01 through FT-07. Enquiry unit tests cover
EF-01 through EF-03; the credential-gated integration test covers persistence,
property linkage, timestamps, initial status and concurrent retry behavior
for EF-04 through EF-06. Auth role-routing tests run locally. The credential-
gated RBAC integration test creates temporary users and records to test invalid
and valid credentials, public denials, agent assignment restrictions, follow-
up ownership, role escalation denial, administrator access and the last-
administrator safeguard. Run that test only on a
disposable Supabase project after all migrations:

```powershell
$env:RUN_SUPABASE_RBAC_TESTS = "1"
$env:NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "your-anon-key"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-server-only-service-role-key"
node --test tests/auth-rbac.integration.test.mjs
```

All tests use Node's built-in test runner.

The gated RBAC integration test also exercises draft creation and editing,
publication visibility, archive visibility, assignment and reassignment, all
six pipeline stages, follow-up and stage activity, and role-scoped report
totals against known temporary records. It must be executed to verify SQL/RLS
behavior; local tests do not connect to the database.

## Available checks

- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript check
- `npm test` — focused property-filter behavior tests
- `npm run build` — production build
