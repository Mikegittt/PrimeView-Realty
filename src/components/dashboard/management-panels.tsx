import Link from "next/link";
import {
  updateLeadAction,
  updateStaffRoleAction,
  recordLeadFollowUpAction,
} from "@/app/dashboard-actions";
import type {
  Json,
  LeadStatus,
  Property,
  UserRole,
} from "@/lib/supabase/database.types";
import { PropertyEditor } from "@/components/dashboard/property-editor";

type LeadRecord = {
  id: string;
  client_name: string;
  email: string;
  phone: string | null;
  property_id: string | null;
  assigned_agent_id: string | null;
  status: LeadStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
};

type StaffProfile = { id: string; full_name: string; role: "admin" | "agent" };
type PropertySummary = { id: string; title: string; location: string };

const leadStatuses: LeadStatus[] = [
  "New",
  "Contacted",
  "Viewing Scheduled",
  "Negotiation",
  "Closed",
  "Lost",
];
export function LeadsPanel({
  leads,
  agents,
  canAssign,
  propertiesById,
  heading = "Enquiries",
}: {
  leads: LeadRecord[];
  agents: StaffProfile[];
  canAssign: boolean;
  propertiesById: Record<string, PropertySummary>;
  heading?: string;
}) {
  return (
    <section className="dashboard-panel" aria-labelledby="leads-heading">
      <div className="dashboard-panel__heading">
        <div>
          <p className="eyebrow eyebrow--muted">Client pipeline</p>
          <h2 id="leads-heading">{heading}</h2>
        </div>
        <span className="dashboard-count">{leads.length}</span>
      </div>
      {!leads.length ? <p>No leads match these filters.</p> : null}
      <div className="dashboard-record-list">
        {leads.map((lead) => (
          <article className="dashboard-record" key={lead.id}>
            <div className="dashboard-record__content">
              <h3><Link href={`/leads/${lead.id}`}>{lead.client_name} · View details</Link></h3>
              <p>
                <a href={`mailto:${encodeURIComponent(lead.email)}`}>{lead.email}</a>
                {lead.phone && <> · <a href={`tel:${encodeURIComponent(lead.phone)}`}>{lead.phone}</a></>}
              </p>
              {lead.property_id && propertiesById[lead.property_id] ? (
                <p>Property: <Link href={`/properties/${lead.property_id}`}>{propertiesById[lead.property_id].title}</Link> · {propertiesById[lead.property_id].location}</p>
              ) : <p>Property: No listing linked</p>}
              <p>{lead.message || "No message provided."}</p>
              <small>Received {new Date(lead.created_at).toLocaleString("en-NG")}</small>
              <small>Updated {new Date(lead.updated_at).toLocaleString("en-NG")}</small>
            </div>
            <form className="record-controls" action={updateLeadAction}>
              <input type="hidden" name="leadId" value={lead.id} />
              <label className="form-field">
                <span>Pipeline stage</span>
                <select name="status" defaultValue={lead.status}>
                  {leadStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              {canAssign && (
                <label className="form-field">
                  <span>Assigned agent</span>
                  <select name="assignedAgentId" defaultValue={lead.assigned_agent_id ?? ""}>
                    <option value="">Unassigned</option>
                    {agents.filter((agent) => agent.role === "agent").map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.full_name || "Unnamed agent"}</option>
                    ))}
                  </select>
                </label>
              )}
              <button className="button button--navy" type="submit">Save lead</button>
            </form>
            <form className="follow-up-form" action={recordLeadFollowUpAction}>
              <input type="hidden" name="leadId" value={lead.id} />
              <label className="form-field">
                <span>Record follow-up</span>
                <textarea
                  name="description"
                  rows={2}
                  maxLength={500}
                  placeholder="Add a concise note about the next step."
                  required
                />
              </label>
              <button className="button button--light" type="submit">Add note</button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PropertiesPanel({
  properties,
  agents,
  role,
  userId,
  total,
  page,
  pageSize,
  action,
  search,
  status,
  leadPage,
}: {
  properties: Property[];
  agents: StaffProfile[];
  role: UserRole;
  userId: string;
  total: number;
  page: number;
  pageSize: number;
  action: string;
  search: string;
  status: string;
  leadPage: number;
}) {
  return (
    <section className="dashboard-panel" aria-labelledby="properties-heading">
      <div className="dashboard-panel__heading">
        <div>
          <p className="eyebrow eyebrow--muted">Property inventory</p>
          <h2 id="properties-heading">Listings</h2>
        </div>
        <span className="dashboard-count">{properties.length}</span>
      </div>
      <details className="property-create">
        <summary>Create a property listing</summary>
        <PropertyEditor agents={agents} role={role} userId={userId} />
      </details>
      {!properties.length ? <p>No listings to display. Create a draft listing to get started.</p> : null}
      <div className="dashboard-record-list">
        {properties.map((property) => (
          <article className="dashboard-record dashboard-record--property" key={property.id}>
            <div className="dashboard-record__content">
              <h3>{property.title}</h3>
              <p>{property.location} · {property.property_type}</p>
              <p>{property.purpose === "rent" ? "For rent" : "For sale"} · Publication: <strong>{property.status}</strong></p>
              <small>Updated {new Date(property.updated_at).toLocaleString("en-NG")}</small>
            </div>
            <details className="property-edit">
              <summary>Edit listing details</summary>
              <PropertyEditor
                property={property}
                agents={agents}
                role={role}
                userId={userId}
              />
            </details>
          </article>
        ))}
      </div>
      <PropertyPagination
        action={action}
        page={page}
        pageSize={pageSize}
        total={total}
        search={search}
        status={status}
        leadPage={leadPage}
      />
    </section>
  );
}

export function ActivityPanel({
  entries,
}: {
  entries: Array<{
    id: string;
    lead_id?: string | null;
    property_id?: string | null;
    action: string;
    description: string;
    created_at: string;
    actor_name?: string | null;
    change_details?: Json;
  }>;
}) {
  return (
    <section className="dashboard-panel" aria-labelledby="activity-heading">
      <div className="dashboard-panel__heading">
        <div>
          <p className="eyebrow eyebrow--muted">Audit history</p>
          <h2 id="activity-heading">Recent activity</h2>
        </div>
      </div>
      {entries.length ? (
        <ol className="activity-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.description}</strong>
              <span>{entry.action.replaceAll(".", " · ")}</span>
              <span>{entry.actor_name || "Public enquiry / system action"}</span>
              {entry.lead_id && <Link href={`/leads/${entry.lead_id}`}>Open affected lead</Link>}
              {entry.property_id && <Link href={`/properties/${entry.property_id}`}>Open affected property</Link>}
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
      ) : <p>No activity records to display.</p>}
    </section>
  );
}

export function StaffPanel({
  profiles,
  currentUserId,
}: {
  profiles: StaffProfile[];
  currentUserId: string;
}) {
  return (
    <section className="dashboard-panel" aria-labelledby="staff-list-heading">
      <div className="dashboard-panel__heading">
        <div>
          <p className="eyebrow eyebrow--muted">Access management</p>
          <h2 id="staff-list-heading">Agency staff</h2>
        </div>
        <span className="dashboard-count">{profiles.length}</span>
      </div>
      <div className="dashboard-record-list">
        {profiles.map((staff) => (
          <article className="dashboard-record dashboard-record--property" key={staff.id}>
            <div className="dashboard-record__content">
              <h3>{staff.full_name || "Unnamed staff member"}</h3>
              <small>{staff.id === currentUserId ? "Your account" : "Staff account"}</small>
            </div>
            <form className="record-controls record-controls--property" action={updateStaffRoleAction}>
              <input type="hidden" name="userId" value={staff.id} />
              <label className="form-field">
                <span>Account role</span>
                <select name="role" defaultValue={staff.role}>
                  <option value="agent">Agent</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <button className="button button--navy" type="submit">Update access</button>
            </form>
          </article>
        ))}
      </div>
      <p className="staff-policy-note">
        The database prevents an administrator from removing the final administrator account.
      </p>
    </section>
  );
}

export function LeadFilters({
  search,
  status,
  action,
}: {
  search: string;
  status: string;
  action: string;
}) {
  return (
    <form className="lead-filters" action={action} method="get">
      <label className="form-field">
        <span>Search client name</span>
        <input name="q" maxLength={80} defaultValue={search} placeholder="Search enquiries" />
      </label>
      <label className="form-field">
        <span>Pipeline stage</span>
        <select name="status" defaultValue={status}>
          <option value="">All stages</option>
          {leadStatuses.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
      </label>
      <button className="button button--light" type="submit">Filter leads</button>
    </form>
  );
}

export function LeadPagination({
  action,
  page,
  pageSize,
  total,
  search,
  status,
}: {
  action: string;
  page: number;
  pageSize: number;
  total: number;
  search: string;
  status: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  function pageHref(nextPage: number) {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (status) query.set("status", status);
    query.set("page", String(nextPage));
    return `${action}?${query.toString()}`;
  }

  return (
    <nav className="lead-pagination" aria-label="Lead pages">
      <span>Page {page} of {pageCount} · {total} matching leads</span>
      <div>
        {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
        {page < pageCount ? <Link href={pageHref(page + 1)}>Next</Link> : <span>Next</span>}
      </div>
    </nav>
  );
}

export function PropertyPagination({
  action,
  page,
  pageSize,
  total,
  search,
  status,
  leadPage,
}: {
  action: string;
  page: number;
  pageSize: number;
  total: number;
  search: string;
  status: string;
  leadPage: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  function pageHref(nextPage: number) {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (status) query.set("status", status);
    query.set("page", String(leadPage));
    query.set("propertyPage", String(nextPage));
    return `${action}?${query.toString()}#properties-heading`;
  }

  return (
    <nav className="lead-pagination" aria-label="Property pages">
      <span>Page {page} of {pageCount} · {total} listings</span>
      <div>
        {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
        {page < pageCount ? <Link href={pageHref(page + 1)}>Next</Link> : <span>Next</span>}
      </div>
    </nav>
  );
}

export function LeadDetailsLink({ leadId, role }: { leadId: string; role: UserRole }) {
  return   <Link className="text-link" href={`/leads/${leadId}`}>Open {role === "admin" ? "agency" : "lead"} details <span aria-hidden="true">→</span></Link>;
}
