import Link from "next/link";

type QuickAction = {
  href: string;
  label: string;
};

type QuickActionsProps = {
  actions: QuickAction[];
};

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <section className="dashboard-card">
      <h2>Quick actions</h2>
      <div className="quick-actions-grid">
        {actions.map((action) => (
          <Link className="quick-action-link" href={action.href} key={action.href}>
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
