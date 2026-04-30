import { SuppliersClient } from "./suppliers-client";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    from_date?: string;
    to_date?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <SuppliersClient
      fromDate={params?.from_date ?? ""}
      saveError={params?.error}
      toDate={params?.to_date ?? ""}
    />
  );
}
