import { RecipesClient } from "./recipes-client";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return <RecipesClient saveError={params?.error} />;
}
