import { CostReportPage } from "../../cost-report";

export const dynamic = "force-dynamic";

export default async function BarCostPage({
  searchParams,
}: {
  searchParams?: Promise<{
    from_date?: string;
    to_date?: string;
  }>;
}) {
  return (
    <CostReportPage
      costType="bar"
      searchParams={searchParams}
      title="Bar Cost"
    />
  );
}
