import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateLeadAction, recordLeadFollowUpAction } from "@/app/dashboard-actions";
import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { getAuthenticatedProfile } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lead details" };

const statuses: LeadStatus[] = [
  "New",
  "Contacted",
  "Viewing Scheduled",
  "Negotiation",
  "Closed",
  "Lost",
];

type LeadDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function LeadDetailPage({ params, searchParams }: LeadDetailPageProps) {
  const [profile, { id }, query] = await Promise.all([
    getAuthenticatedProfile(),
    params,
    searchParams,
  ]);
  if (!profile) redirect(`/sign-in?next=${encodeURIComponent(`/leads/${id}`)}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, client_name, email, phone, property_id, assigned_agent_id, status, message, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (leadError) {
    console.error("Could not load authorized lead details:", leadError.code);
    throw new Error("Lead details could not be loaded.");
  }
  if (!lead) notFound();

  const [propertyResult, activityResult, profilesResult] = await Promise.all([
    lead.property_id
      ? supabase.from("properties").select("id, title, location").eq("id", lead.property_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("activity_logs")
      .select("id, actor_user_id, action, description, change_details, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(100),
    profile.role === "admin"
      ? supabase.from("profiles").select("id, full_name, role").order("full_name")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const loadingError = propertyResult.error ?? activityResult.error ?? profilesResult.error;
  if (loadingError) {
    console.error("Could not load related authorized lead records:", loadingError.code);
    throw new Error("Lead history could not be loaded.");
  }
  const assignedAgent = profilesResult.data?.find((staff) => staff.id === lead.assigned_agent_id);
  const returnPath = profile.role === "admin" ? "/admin" : "/agent";

  return (
    <DashboardFrame profile={profile} title="Lead details">
      <div className="lead-detail-nav">
        <Link className="text-link" href={returnPath}>← Back to workspace</Link>
      </div>
      {query.notice === "lead-updated" && <p className="auth-notice" role="status">Lead changes saved.</p>}
      {query.notice === "follow-up-recorded" && <p className="auth-notice" role="status">Follow-up recorded.</p>}
      {query.notice === "update-failed" && <p className="form-message" role="alert">The update was not allowed or could not be saved.</p>}
      <section className="dashboard-panel lead-detail" aria-labelledby="lead-detail-heading">
        <div className="dashboard-panel__heading">
          <div>
            <p className="eyebrow eyebrow--muted">Authorized client record</p>
            <h2 id="lead-detail-heading">{lead.client_name}</h2>
          </div>
          <span className="lead-status-badge">{lead.status}</span>
        </div>
        <div className="lead-detail__grid">
          <div>
            <h3>Contact</h3>
            <p><a href={`mailto:${encodeURIComponent(lead.email)}`}>{lead.email}</a></p>
            {lead.phone && <p><a href={`tel:${encodeURIComponent(lead.phone)}`}>{lead.phone}</a></p>}
          </div>
          <div>
            <h3>Property of interest</h3>
            {propertyResult.data ? (
              <p><Link href={`/properties/${propertyResult.data.id}`}>{propertyResult.data.title}</Link><br />{propertyResult.data.location}</p>
            ) : <p>No property linked.</p>}
          </div>
          <div>
            <h3>Assigned agent</h3>
            <p>{assignedAgent?.full_name || (lead.assigned_agent_id ? "Assigned staff member" : "Unassigned")}</p>
          </div>
          <div>
            <h3>Timeline</h3>
            <p>Created <time dateTime={lead.created_at}>{new Date(lead.created_at).toLocaleString("en-NG")}</time></p>
            <p>Updated <time dateTime={lead.updated_at}>{new Date(lead.updated_at).toLocaleString("en-NG")}</time></p>
          </div>
        </div>
        <div className="lead-detail__message">
          <h3>Enquiry message</h3>
          <p>{lead.message || "No message provided."}</p>
        </div>
        <form className="record-controls lead-detail__controls" action={updateLeadAction}>
          <input type="hidden" name="leadId" value={lead.id} />
          <label className="form-field">
            <span>Pipeline stage</span>
            <select name="status" defaultValue={lead.status}>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          {profile.role === "admin" && (
            <label className="form-field">
              <span>Assigned agent</span>
              <select name="assignedAgentId" defaultValue={lead.assigned_agent_id ?? ""}>
                <option value="">Unassigned</option>
                {profilesResult.data?.filter((staff) => staff.role === "agent").map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.full_name || "Unnamed agent"}</option>
                ))}
              </select>
            </label>
          )}
          <button className="button button--navy" type="submit">Save changes</button>
        </form>
        <form className="follow-up-form lead-detail__follow-up" action={recordLeadFollowUpAction}>
          <input type="hidden" name="leadId" value={lead.id} />
          <label className="form-field">
            <span>Record a follow-up</span>
            <textarea name="description" rows={3} maxLength={500} required />
          </label>
          <button className="button button--light" type="submit">Add to activity history</button>
        </form>
      </section>
      <section className="dashboard-panel" aria-labelledby="lead-history-heading">
        <div className="dashboard-panel__heading">
          <div><p className="eyebrow eyebrow--muted">Persisted audit trail</p><h2 id="lead-history-heading">Lead activity</h2></div>
        </div>
        {activityResult.data?.length ? (
          <ol className="activity-list">
            {activityResult.data.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.description}</strong>
                <span>{entry.action.replaceAll(".", " · ")}</span>
                <span>{entry.actor_user_id === profile.id ? "You" : entry.actor_user_id ? "Agency staff" : "Public visitor"}</span>
                {entry.change_details !== null &&
                  typeof entry.change_details === "object" &&
                  !Array.isArray(entry.change_details) &&
                  Object.keys(entry.change_details).length > 0 && (
                  <code className="activity-changes">{JSON.stringify(entry.change_details)}</code>
                )}
                <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString("en-NG")}</time>
              </li>
            ))}
          </ol>
        ) : <p>No activity recorded for this lead.</p>}
      </section>
    </DashboardFrame>
  );
}
