import { Department, EmployeePage } from "../food/employee-page";

function getDepartment(value: string | undefined): Department {
  if (value === "bar" || value === "front" || value === "kitchen") {
    return value;
  }

  return "kitchen";
}

function getTitle(department: Department) {
  if (department === "bar") return "Bar Employees";
  if (department === "front") return "Front Employees";

  return "Kitchen Employees";
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<{ department?: string; error?: string }>;
}) {
  const params = await searchParams;
  const department = getDepartment(params?.department);

  return (
    <EmployeePage
      department={department}
      error={params?.error}
      title={getTitle(department)}
    />
  );
}
