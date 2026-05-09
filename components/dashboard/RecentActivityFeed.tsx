type ActivityItem = {
  date?: string | null;
  detail: string;
  title: string;
};

type RecentActivityFeedProps = {
  items: ActivityItem[];
};

function formatActivityDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function RecentActivityFeed({ items }: RecentActivityFeedProps) {
  return (
    <section className="dashboard-card">
      <h2>Recent activity</h2>
      {items.length === 0 ? (
        <p className="muted">No recent activity yet.</p>
      ) : (
        <div className="activity-feed">
          {items.map((item, index) => (
            <div className="activity-item" key={`${item.title}-${index}`}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              <span>{formatActivityDate(item.date)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
