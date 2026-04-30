import { EmployeePage } from "../employee-page";

export default async function KitchenEmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <EmployeePage
      department="kitchen"
      error={params?.error}
      title="Kitchen Employees"
    />
  );
}
