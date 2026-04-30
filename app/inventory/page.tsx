import { InventoryClient } from "./inventory-client";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return <InventoryClient saveError={params?.error} />;
}
