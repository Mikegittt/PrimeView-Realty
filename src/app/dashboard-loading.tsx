export function DashboardLoading() {
  return (
    <main className="dashboard-page" aria-busy="true" aria-label="Loading agency workspace">
      <div className="dashboard-main">
        <div className="dashboard-loading-block" />
        <div className="dashboard-loading-cards">
          <div className="dashboard-loading-block" />
          <div className="dashboard-loading-block" />
          <div className="dashboard-loading-block" />
        </div>
        <div className="dashboard-loading-block dashboard-loading-block--large" />
      </div>
    </main>
  );
}
