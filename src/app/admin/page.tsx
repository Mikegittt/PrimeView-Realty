import { StaffInvitationForm } from "@/components/auth/staff-invitation-form";
import {
  ActivityPanel,
  LeadsPanel,
  PropertiesPanel,
  StaffPanel,
  LeadFilters,
  LeadPagination,
} from "@/components/dashboard/management-panels";
import { ReportPanel } from "@/components/dashboard/report-panel";
import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { requireRole } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{ notice?: string; q?: string; status?: string; page?: string; propertyPage?: string }>;
};

const leadPageSize = 50;
const propertyPageSize = 50;
const stages: LeadStatus[] = [
  "New",
  "Contacted",
  "Viewing Scheduled",
  "Negotiation",
  "Closed",
  "Lost",
];

function Notice({ value }: { value?: string }) {
  if (value === "lead-updated") return <p className="auth-notice" role="status">Lead changes saved.</p>;
  if (value === "property-updated") return <p className="auth-notice" role="status">Listing changes saved.</p>;
  if (value === "follow-up-recorded") return <p className="auth-notice" role="status">Follow-up note recorded.</p>;
  if (value === "update-failed") return <p className="form-message" role="alert">The change could not be saved.</p>;
  if (value === "invalid-update") return <p className="form-message" role="alert">The update contains invalid values.</p>;
  if (value === "role-updated") return <p className="auth-notice" role="status">Staff access updated.</p>;
  if (value === "last-admin") return <p className="form-message" role="alert">The final administrator account cannot be removed.</p>;
  if (value === "invalid-property") return <p className="form-message" role="alert">Check the listing fields. Image URLs must be HTTPS URLs.</p>;
  if (value === "property-saved") return <p className="auth-notice" role="status">Property listing saved.</p>;
  if (value === "property-save-failed") return <p className="form-message" role="alert">The listing could not be saved. Check your assignment and access.</p>;
  return null;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const profile = await requireRole("admin", "/admin");
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const search = (params.q ?? "").replace(/[^\p{L}\p{N}@.+\- ]/gu, "").trim().slice(0, 80);
  const status = stages.find((stage) => stage === params.status) ?? "";
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedPropertyPage = Number(params.propertyPage);
  const propertyPage =
    Number.isSafeInteger(requestedPropertyPage) && requestedPropertyPage > 0 ? requestedPropertyPage : 1;
  let leadsQuery = supabase
      .from("leads")
      .select("id, client_name, email, phone, property_id, assigned_agent_id, status, message, created_at, updated_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * leadPageSize, page * leadPageSize - 1);
  if (search) leadsQuery = leadsQuery.ilike("client_name", `%${search}%`);
  if (status) leadsQuery = leadsQuery.eq("status", status);

  const [leadResult, propertyResult, profileResult, metricsResult] = await Promise.all([
    leadsQuery,
    supabase
      .from("properties")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range((propertyPage - 1) * propertyPageSize, propertyPage * propertyPageSize - 1),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
    supabase.rpc("get_dashboard_metrics"),
  ]);
  const linkedPropertyIds = [
    ...new Set((leadResult.data ?? []).flatMap((lead) => (lead.property_id ? [lead.property_id] : []))),
  ];
  const propertyLookupResult = linkedPropertyIds.length
    ? await supabase.from("properties").select("id, title, location").in("id", linkedPropertyIds)
    : { data: [], error: null };
  const dataError =
    leadResult.error ?? propertyResult.error ?? profileResult.error ?? propertyLookupResult.error ?? metricsResult.error;
  if (
    dataError ||
    !leadResult.data ||
    !propertyResult.data ||
    !profileResult.data ||
    !propertyLookupResult.data ||
    !metricsResult.data
  ) {
    return (
      <DashboardFrame profile={profile} title="Agency administration">
        <Notice value={params.notice} />
        <section className="dashboard-panel" aria-labelledby="staff-heading">
          <div className="dashboard-panel__heading">
            <div>
              <p className="eyebrow eyebrow--muted">Secure provisioning</p>
              <h2 id="staff-heading">Invite agency staff</h2>
            </div>
          </div>
          <p>Invited accounts start as agents. Administrator privileges are assigned only from this authenticated administrator workflow.</p>
          <StaffInvitationForm />
        </section>
        <div className="dashboard-error" role="alert">
          <h2>Workspace data is unavailable.</h2>
          <p>Some records could not be loaded. No data is being substituted.</p>
        </div>
      </DashboardFrame>
    );
  }

  return (
    <DashboardFrame profile={profile} title="Agency administration">
      <Notice value={params.notice} />
      <section className="dashboard-panel" aria-labelledby="staff-heading">
        <div className="dashboard-panel__heading">
          <div>
            <p className="eyebrow eyebrow--muted">Secure provisioning</p>
            <h2 id="staff-heading">Invite agency staff</h2>
          </div>
        </div>
        <p>Invited accounts start as agents. Administrator privileges are assigned only from this authenticated administrator workflow.</p>
        <StaffInvitationForm />
      </section>
      <div className="dashboard-summary">
        <article><strong>{metricsResult.data.totalLeads}</strong><span>Total agency leads</span></article>
        <article><strong>{metricsResult.data.publishedPropertyTotal}</strong><span>Published properties</span></article>
        <article><strong>{metricsResult.data.newLeads}</strong><span>New leads</span></article>
      </div>
      <ReportPanel metrics={metricsResult.data} />
      <div className="dashboard-columns">
        <div className="dashboard-section-stack">
          <LeadFilters search={search} status={status} action="/admin" />
        <LeadsPanel
          leads={leadResult.data}
          agents={profileResult.data}
          canAssign
          propertiesById={Object.fromEntries(propertyLookupResult.data.map((property) => [property.id, property]))}
        />
          <LeadPagination
            action="/admin"
            page={page}
            pageSize={leadPageSize}
            total={leadResult.count ?? 0}
            search={search}
            status={status}
          />
        </div>
        <PropertiesPanel
          properties={propertyResult.data}
          agents={profileResult.data}
          role="admin"
          userId={profile.id}
          total={propertyResult.count ?? 0}
          page={propertyPage}
          pageSize={propertyPageSize}
          action="/admin"
          search={search}
          status={status}
          leadPage={page}
        />
      </div>
      <StaffPanel profiles={profileResult.data} currentUserId={profile.id} />
      <ActivityPanel entries={metricsResult.data.recentActivity} />
    </DashboardFrame>
  );
}
