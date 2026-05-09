export function LoadingState() {
  return (
    <main>
      <div className="dashboard-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Loading restaurant overview...</p>
        </div>
      </div>
      <div className="dashboard-grid kpi-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="dashboard-skeleton" key={index} />
        ))}
      </div>
    </main>
  );
}
