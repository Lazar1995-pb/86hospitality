type ChartDatum = {
  label: string;
  value: number;
};

type DashboardChartCardProps = {
  data: ChartDatum[];
  emptyText?: string;
  title: string;
  valueFormatter?: (value: number) => string;
};

export function DashboardChartCard({
  data,
  emptyText = "No data yet.",
  title,
  valueFormatter = (value) => String(value),
}: DashboardChartCardProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);

  return (
    <section className="dashboard-card dashboard-chart-card">
      <h2>{title}</h2>
      {data.length === 0 || maxValue === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <div className="dashboard-chart-list">
          {data.map((item) => (
            <div className="dashboard-chart-row" key={item.label}>
              <div className="dashboard-chart-meta">
                <span>{item.label}</span>
                <strong>{valueFormatter(item.value)}</strong>
              </div>
              <div className="dashboard-chart-track">
                <div
                  className="dashboard-chart-bar"
                  style={{ width: `${Math.max((item.value / maxValue) * 100, 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
