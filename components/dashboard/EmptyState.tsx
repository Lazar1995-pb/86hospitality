type EmptyStateProps = {
  text: string;
  title: string;
};

export function EmptyState({ text, title }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </section>
  );
}
