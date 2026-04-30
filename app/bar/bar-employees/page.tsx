import { EmployeePage } from "../../food/employee-page";

export default async function BarEmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <EmployeePage
      department="bar"
      error={params?.error}
      title="Bar Employees"
    />
  );
}
