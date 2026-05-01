import { getSupabaseClient } from "@/lib/supabase";
import { getCurrentUserRestaurantId } from "@/lib/current-restaurant";

type Grouping = "daily" | "weekly" | "monthly";

type SaleRow = {
  sale_date: string | null;
  quantity: number | null;
  revenue: number | null;
  menu_items:
    | {
        theoretical_cost: number | null;
      }
    | {
        theoretical_cost: number | null;
      }[]
    | null;
};

type InvoiceRow = {
  invoice_date: string | null;
  total: number | null;
};

type InventoryCountRow = {
  count_date: string | null;
  inventory_count_items: {
    quantity: number | null;
    inventory_items:
      | {
          base_unit_cost: number | null;
        }
      | {
          base_unit_cost: number | null;
        }[]
      | null;
  }[];
};

type ReportRow = {
  period: string;
  totalSales: number;
  theoreticalCost: number;
  realCost: number;
  foodCostPercent: number | null;
  variance: number;
};

type Filters = {
  fromDate: string;
  grouping: Grouping;
  toDate: string;
};

function getRelatedItem<T>(item: T | T[] | null | undefined): T | null {
  if (Array.isArray(item)) {
    return item[0] ?? null;
  }

  return item ?? null;
}

function getDate(value: string | null) {
  if (!value) return null;

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isInRange(value: string | null, filters: Filters) {
  const date = getDate(value);
  if (!date) return false;

  if (filters.fromDate && date < new Date(`${filters.fromDate}T00:00:00`)) {
    return false;
  }

  if (filters.toDate && date > new Date(`${filters.toDate}T23:59:59`)) {
    return false;
  }

  return true;
}

function getPeriod(value: string | null, grouping: Grouping) {
  const date = getDate(value);
  if (!date) return "Unknown";

  if (grouping === "daily") {
    return date.toISOString().slice(0, 10);
  }

  if (grouping === "weekly") {
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() + (day === 0 ? -6 : 1 - day));

    return weekStart.toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 7);
}

function getPeriodStart(period: string, grouping: Grouping) {
  return new Date(`${grouping === "monthly" ? `${period}-01` : period}T00:00:00`);
}

function getPeriodEnd(period: string, grouping: Grouping) {
  const date = getPeriodStart(period, grouping);

  if (grouping === "daily") {
    date.setDate(date.getDate() + 1);
  } else if (grouping === "weekly") {
    date.setDate(date.getDate() + 7);
  } else {
    date.setMonth(date.getMonth() + 1);
  }

  date.setMilliseconds(date.getMilliseconds() - 1);
  return date;
}

function getInventoryValue(count: InventoryCountRow | null) {
  if (!count) return 0;

  return (count.inventory_count_items ?? []).reduce((sum, item) => {
    const inventoryItem = getRelatedItem(item.inventory_items);

    return sum + (item.quantity ?? 0) * (inventoryItem?.base_unit_cost ?? 0);
  }, 0);
}

function findLatestCount(counts: InventoryCountRow[], targetDate: Date) {
  return counts
    .filter((count) => {
      const countDate = getDate(count.count_date);
      return countDate && countDate <= targetDate;
    })
    .sort((a, b) => {
      const first = getDate(a.count_date)?.getTime() ?? 0;
      const second = getDate(b.count_date)?.getTime() ?? 0;

      return second - first;
    })[0] ?? null;
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || value === undefined) return "-";

  return `${formatAmount(value)} %`;
}

async function getSales(restaurantId: string) {
  const supabase = getSupabaseClient();

  return supabase
    .from("sales")
    .select(
      `
        sale_date,
        quantity,
        revenue,
        menu_items (
          theoretical_cost
        )
      `,
    )
    .eq("restaurant_id", restaurantId);
}

async function getInvoices(restaurantId: string) {
  const supabase = getSupabaseClient();

  return supabase
    .from("invoices")
    .select("invoice_date, total")
    .eq("restaurant_id", restaurantId);
}

async function getInventoryCounts(restaurantId: string) {
  const supabase = getSupabaseClient();

  return supabase
    .from("inventory_counts")
    .select(
      `
        count_date,
        inventory_count_items (
          quantity,
          inventory_items (
            base_unit_cost
          )
        )
      `,
    )
    .eq("restaurant_id", restaurantId);
}

function buildReportRows(
  sales: SaleRow[],
  invoices: InvoiceRow[],
  inventoryCounts: InventoryCountRow[],
  filters: Filters,
) {
  const periodSet = new Set<string>();

  sales
    .filter((sale) => isInRange(sale.sale_date, filters))
    .forEach((sale) => periodSet.add(getPeriod(sale.sale_date, filters.grouping)));

  invoices
    .filter((invoice) => isInRange(invoice.invoice_date, filters))
    .forEach((invoice) =>
      periodSet.add(getPeriod(invoice.invoice_date, filters.grouping)),
    );

  inventoryCounts
    .filter((count) => isInRange(count.count_date, filters))
    .forEach((count) => periodSet.add(getPeriod(count.count_date, filters.grouping)));

  return Array.from(periodSet)
    .sort()
    .map<ReportRow>((period) => {
      const periodStart = getPeriodStart(period, filters.grouping);
      const periodEnd = getPeriodEnd(period, filters.grouping);
      const openingInventory = getInventoryValue(
        findLatestCount(inventoryCounts, periodStart),
      );
      const closingInventory = getInventoryValue(
        findLatestCount(inventoryCounts, periodEnd),
      );
      const periodSales = sales.filter(
        (sale) => getPeriod(sale.sale_date, filters.grouping) === period,
      );
      const periodInvoices = invoices.filter(
        (invoice) => getPeriod(invoice.invoice_date, filters.grouping) === period,
      );
      const totalSales = periodSales.reduce(
        (sum, sale) => sum + (sale.revenue ?? 0),
        0,
      );
      const theoreticalCost = periodSales.reduce((sum, sale) => {
        const menuItem = getRelatedItem(sale.menu_items);

        return sum + (sale.quantity ?? 0) * (menuItem?.theoretical_cost ?? 0);
      }, 0);
      const purchases = periodInvoices.reduce(
        (sum, invoice) => sum + (invoice.total ?? 0),
        0,
      );
      const realCost = openingInventory + purchases - closingInventory;

      return {
        foodCostPercent: totalSales ? (realCost / totalSales) * 100 : null,
        period,
        realCost,
        theoreticalCost,
        totalSales,
        variance: realCost - theoreticalCost,
      };
    });
}

export const dynamic = "force-dynamic";

export default async function RealFoodCostPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    from_date?: string;
    grouping?: string;
    to_date?: string;
  }>;
}) {
  const params = await searchParams;
  const grouping =
    params?.grouping === "daily" || params?.grouping === "weekly"
      ? params.grouping
      : "monthly";
  const filters: Filters = {
    fromDate: params?.from_date ?? "",
    grouping,
    toDate: params?.to_date ?? "",
  };
  const restaurantId = await getCurrentUserRestaurantId();
  const { data: salesData, error: salesError } = await getSales(restaurantId);
  const { data: invoiceData, error: invoiceError } =
    await getInvoices(restaurantId);
  const { data: countData, error: countError } =
    await getInventoryCounts(restaurantId);
  const reportRows = buildReportRows(
    (salesData ?? []) as SaleRow[],
    (invoiceData ?? []) as InvoiceRow[],
    (countData ?? []) as InventoryCountRow[],
    filters,
  );
  const summary = reportRows.reduce(
    (acc, row) => ({
      realCost: acc.realCost + row.realCost,
      theoreticalCost: acc.theoreticalCost + row.theoreticalCost,
      totalSales: acc.totalSales + row.totalSales,
      variance: acc.variance + row.variance,
    }),
    { realCost: 0, theoreticalCost: 0, totalSales: 0, variance: 0 },
  );
  const summaryFoodCostPercent = summary.totalSales
    ? (summary.realCost / summary.totalSales) * 100
    : null;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Real Food Cost</h1>
          <p>Compare theoretical cost with actual inventory cost.</p>
        </div>
      </div>

      {params?.error ? (
        <div className="error-state">
          <strong>Could not load report.</strong>
          <p>{params.error}</p>
        </div>
      ) : null}

      {salesError ? (
        <div className="error-state">
          <strong>Could not load sales.</strong>
          <p>{salesError.message}</p>
        </div>
      ) : null}

      {invoiceError ? (
        <div className="error-state">
          <strong>Could not load purchases.</strong>
          <p>{invoiceError.message}</p>
        </div>
      ) : null}

      {countError ? (
        <div className="error-state">
          <strong>Could not load inventory counts.</strong>
          <p>{countError.message}</p>
        </div>
      ) : null}

      <form className="form-card kpi-filters">
        <label>
          From date
          <input defaultValue={filters.fromDate} name="from_date" type="date" />
        </label>

        <label>
          To date
          <input defaultValue={filters.toDate} name="to_date" type="date" />
        </label>

        <label>
          Report period
          <select defaultValue={filters.grouping} name="grouping">
            <option value="daily">Day</option>
            <option value="weekly">Week</option>
            <option value="monthly">Month</option>
          </select>
        </label>

        <button className="button" type="submit">
          Apply filters
        </button>
      </form>

      <div className="summary-grid">
        <div className="summary-card">
          <span className="label">Total sales</span>
          <span className="value">{formatAmount(summary.totalSales)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Theoretical cost</span>
          <span className="value">{formatAmount(summary.theoreticalCost)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Real cost</span>
          <span className="value">{formatAmount(summary.realCost)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Food cost %</span>
          <span className="value">{formatPercent(summaryFoodCostPercent)}</span>
        </div>
      </div>

      {reportRows.length > 0 ? (
        <table className="items-table inventory-table">
          <thead>
            <tr>
              <th>Period</th>
              <th className="number">Total sales</th>
              <th className="number">Theoretical cost</th>
              <th className="number">Real cost</th>
              <th className="number">Food cost %</th>
              <th className="number">Variance</th>
            </tr>
          </thead>
          <tbody>
            {reportRows.map((row) => (
              <tr key={row.period}>
                <td>{row.period}</td>
                <td className="number">{formatAmount(row.totalSales)}</td>
                <td className="number">{formatAmount(row.theoreticalCost)}</td>
                <td className="number">{formatAmount(row.realCost)}</td>
                <td className="number">{formatPercent(row.foodCostPercent)}</td>
                <td className="number">{formatAmount(row.variance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty-state">No real food cost data yet.</div>
      )}
    </main>
  );
}
