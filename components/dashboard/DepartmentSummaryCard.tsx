type DepartmentSummaryCardProps = {
  employeesCount: number;
  laborCost: string;
  laborPercent: string;
  name: string;
  profitAfterLabor: string;
  purchasesCost: string;
  revenue: string;
  totalDepartmentCost: string;
};

export function DepartmentSummaryCard({
  employeesCount,
  laborCost,
  laborPercent,
  name,
  profitAfterLabor,
  purchasesCost,
  revenue,
  totalDepartmentCost,
}: DepartmentSummaryCardProps) {
  return (
    <section className="department-summary-card">
      <h3>{name}</h3>
      <div className="department-summary-grid">
        <div>
          <span className="label">Revenue</span>
          <strong>{revenue}</strong>
        </div>
        <div>
          <span className="label">Purchases / cost</span>
          <strong>{purchasesCost}</strong>
        </div>
        <div>
          <span className="label">Labor cost</span>
          <strong>{laborCost}</strong>
        </div>
        <div>
          <span className="label">Employees</span>
          <strong>{employeesCount}</strong>
        </div>
        <div>
          <span className="label">Labor % of revenue</span>
          <strong>{laborPercent}</strong>
        </div>
        <div>
          <span className="label">Total department cost</span>
          <strong>{totalDepartmentCost}</strong>
        </div>
        <div>
          <span className="label">Profit after labor</span>
          <strong>{profitAfterLabor}</strong>
        </div>
      </div>
    </section>
  );
}
