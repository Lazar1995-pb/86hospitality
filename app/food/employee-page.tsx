import { EmployeeClient } from "./employee-client";

export type Department = "kitchen" | "bar" | "front";

type EmployeePageProps = {
  department: Department;
  error?: string;
  title: string;
};

export function EmployeePage({ department, error, title }: EmployeePageProps) {
  return <EmployeeClient department={department} saveError={error} title={title} />;
}
