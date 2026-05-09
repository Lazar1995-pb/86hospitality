type AlertItem = {
  detail: string;
  title: string;
  tone?: "warning" | "danger" | "neutral";
};

type LowStockAlertsProps = {
  items: AlertItem[];
};

export function LowStockAlerts({ items }: LowStockAlertsProps) {
  return (
    <section className="dashboard-card">
      <h2>Alerts</h2>
      {items.length === 0 ? (
        <p className="muted">No alerts right now.</p>
      ) : (
        <div className="alert-list">
          {items.map((item, index) => (
            <div className={`alert-item ${item.tone ?? "neutral"}`} key={index}>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
