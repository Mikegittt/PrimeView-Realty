import Link from "next/link";
import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import {
  LeadFilters,
  LeadPagination,
  LeadsPanel,
  PropertiesPanel,
  ActivityPanel,
} from "@/components/dashboard/management-panels";
import { ReportPanel } from "@/components/dashboard/report-panel";
import { requireRole } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AgentPageProps = {
  searchParams: Promise<{ notice?: string; q?: string; status?: string; page?: string; propertyPage?: string }>;
};

const stages = ["New", "Contacted", "Viewing Scheduled", "Negotiation", "Closed", "Lost"] as const;
const leadPageSize = 50;
const propertyPageSize = 50;

function Notice({ value }: { value?: string }) {
  if (value === "lead-updated") return <p className="auth-notice" role="status">Lead changes saved.</p>;
  if (value === "property-updated") return <p className="auth-notice" role="status">Listing changes saved.</p>;
  if (value === "follow-up-recorded") return <p className="auth-notice" role="status">Follow-up note recorded.</p>;
  if (value === "update-failed") return <p className="form-message" role="alert">The change could not be saved. Your access may not allow this update.</p>;
  if (value === "invalid-update") return <p className="form-message" role="alert">The update contains invalid values.</p>;
  if (value === "invalid-property") return <p className="form-message" role="alert">Check the listing fields. Image URLs must be HTTPS URLs.</p>;
  if (value === "property-saved") return <p className="auth-notice" role="status">Property listing saved.</p>;
  if (value === "property-save-failed") return <p className="form-message" role="alert">The listing could not be saved. Check your assignment and access.</p>;
  return null;
}

export default async function AgentPage({ searchParams }: AgentPageProps) {
  const profile = await requireRole("agent", "/agent");
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
      .eq("assigned_agent_id", profile.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * leadPageSize, page * leadPageSize - 1);
  if (search) leadsQuery = leadsQuery.ilike("client_name", `%${search}%`);
  if (status) leadsQuery = leadsQuery.eq("status", status);

  const [leadResult, propertyResult, metricsResult] = await Promise.all([
    leadsQuery,
    supabase
      .from("properties")
      .select("*", { count: "exact" })
      .eq("assigned_agent_id", profile.id)
      .order("updated_at", { ascending: false })
      .range((propertyPage - 1) * propertyPageSize, propertyPage * propertyPageSize - 1),
    supabase.rpc("get_dashboard_metrics"),
  ]);
  const linkedPropertyIds = [
    ...new Set((leadResult.data ?? []).flatMap((lead) => (lead.property_id ? [lead.property_id] : []))),
  ];
  const propertyLookupResult = linkedPropertyIds.length
    ? await supabase.from("properties").select("id, title, location").in("id", linkedPropertyIds)
    : { data: [], error: null };

  const dataError = leadResult.error ?? propertyResult.error ?? propertyLookupResult.error ?? metricsResult.error;
  if (dataError || !leadResult.data || !propertyResult.data || !propertyLookupResult.data || !metricsResult.data) {
    return (
      <DashboardFrame profile={profile} title="Agent portal">
        <Notice value={params.notice} />
        <div className="dashboard-error" role="alert">
          <h2>Workspace data is unavailable.</h2>
          <p>Your permissions were not changed. Refresh the page or contact an administrator.</p>
        </div>
      </DashboardFrame>
    );
  }

  return (
    <DashboardFrame profile={profile} title="Agent portal">
      <Notice value={params.notice} />
      <div className="dashboard-summary">
        <article><strong>{metricsResult.data.totalLeads}</strong><span>Assigned enquiries</span></article>
        <article><strong>{metricsResult.data.publishedPropertyTotal}</strong><span>Assigned published listings</span></article>
        <article><Link href="/properties">Browse public properties <span aria-hidden="true">→</span></Link></article>
      </div>
      <ReportPanel metrics={metricsResult.data} />
      <div className="dashboard-columns">
        <div className="dashboard-section-stack">
          <LeadFilters search={search} status={status} action="/agent" />
          <LeadsPanel
            leads={leadResult.data}
            agents={[]}
            canAssign={false}
            propertiesById={Object.fromEntries(propertyLookupResult.data.map((property) => [property.id, property]))}
          />
          <LeadPagination
            action="/agent"
            page={page}
            pageSize={leadPageSize}
            total={leadResult.count ?? 0}
            search={search}
            status={status}
          />
        </div>
        <PropertiesPanel
          properties={propertyResult.data}
          agents={[]}
          role="agent"
          userId={profile.id}
          total={propertyResult.count ?? 0}
          page={propertyPage}
          pageSize={propertyPageSize}
          action="/agent"
          search={search}
          status={status}
          leadPage={page}
        />
      </div>
      <ActivityPanel entries={metricsResult.data.recentActivity} />
    </DashboardFrame>
  );
}
