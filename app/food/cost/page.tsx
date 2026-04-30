import { CostReportPage } from "../../cost-report";

export const dynamic = "force-dynamic";

export default async function FoodCostPage({
  searchParams,
}: {
  searchParams?: Promise<{
    from_date?: string;
    to_date?: string;
  }>;
}) {
  return (
    <CostReportPage
      costType="food"
      searchParams={searchParams}
      title="Food Cost"
    />
  );
}
