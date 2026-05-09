type DashboardKpiCardProps = {
  icon?: string;
  title: string;
  trend?: string;
  value: string;
};

export function DashboardKpiCard({
  icon,
  title,
  trend,
  value,
}: DashboardKpiCardProps) {
  return (
    <section className="dashboard-kpi-card">
      <div className="dashboard-kpi-heading">
        <span>{title}</span>
        {icon ? <span className="dashboard-kpi-icon">{icon}</span> : null}
      </div>
      <div className="dashboard-kpi-value">{value}</div>
      {trend ? <p>{trend}</p> : null}
    </section>
  );
}
