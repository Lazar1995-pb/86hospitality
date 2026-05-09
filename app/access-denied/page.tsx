import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main>
      <div className="empty-state">
        <h1>Access denied</h1>
        <p>You do not have permission to open this module.</p>
        <Link className="button" href="/">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
