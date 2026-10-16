import type { DashboardMetrics, LeadStatus } from "@/lib/supabase/database.types";

const pipelineStages: LeadStatus[] = [
  "New",
  "Contacted",
  "Viewing Scheduled",
  "Negotiation",
  "Closed",
  "Lost",
];

export function ReportPanel({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <section className="dashboard-panel report-panel" aria-labelledby="reports-heading">
      <div className="dashboard-panel__heading">
        <div>
          <p className="eyebrow eyebrow--muted">Live database totals</p>
          <h2 id="reports-heading">Reports</h2>
        </div>
      </div>
      <p className="report-definition">
        Counts cover all records visible to your role, not just the current lead list.
        Agent totals include only assigned leads and assigned published listings.
      </p>
      <div className="report-summary">
        <article><strong>{metrics.publishedPropertyTotal}</strong><span>Published properties</span></article>
        <article><strong>{metrics.totalLeads}</strong><span>Total visible leads</span></article>
        <article><strong>{metrics.newLeads}</strong><span>New leads</span></article>
        <article><strong>{metrics.closedLeads}</strong><span>Closed</span></article>
        <article><strong>{metrics.lostLeads}</strong><span>Lost</span></article>
      </div>
      <div className="report-tables">
        <div>
          <h3>Leads by pipeline stage</h3>
          <dl className="report-list">
            {pipelineStages.map((stage) => (
              <div key={stage}><dt>{stage}</dt><dd>{metrics.leadsByStage[stage]}</dd></div>
            ))}
          </dl>
        </div>
        <div>
          <h3>Leads by agent</h3>
          {metrics.leadsByAgent.length ? (
            <dl className="report-list">
              {metrics.leadsByAgent.map((agent) => (
                <div key={agent.id ?? "unassigned"}>
                  <dt>{agent.name}</dt>
                  <dd>{agent.total} total · {agent.closed} closed · {agent.lost} lost</dd>
                </div>
              ))}
            </dl>
          ) : <p>No assigned-agent lead records.</p>}
        </div>
      </div>
    </section>
  );
}
