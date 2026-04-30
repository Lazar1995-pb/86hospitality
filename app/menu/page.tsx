import { MenuClient } from "./menu-client";

export default async function MenuPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return <MenuClient saveError={params?.error} />;
}
