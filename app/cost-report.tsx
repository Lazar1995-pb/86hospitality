import { getSupabaseClient } from "@/lib/supabase";
import { getCurrentUserRestaurantId } from "@/lib/current-restaurant";

type CostType = "bar" | "food";

type InvoiceCostRow = {
  cost_category_id: number | null;
  total_price: number | null;
  invoices: RelatedInvoice;
};

type RelatedInvoice =
  | {
      invoice_date: string | null;
    }
  | {
      invoice_date: string | null;
    }[]
  | null;

type SaleRow = {
  sale_date: string | null;
  revenue: number | null;
  menu_items?: RelatedMenuItem;
};

type RelatedMenuItem =
  | {
      category?: string | null;
      type?: string | null;
    }
  | {
      category?: string | null;
      type?: string | null;
    }[]
  | null;

type CostReportPageProps = {
  costType: CostType;
  title: string;
};

const costCategoryIds: Record<CostType, number> = {
  bar: 3,
  food: 7,
};

function getRelatedItem<T>(item: T | T[] | null | undefined): T | null {
  if (Array.isArray(item)) {
    return item[0] ?? null;
  }

  return item ?? null;
}

function isInDateRange(
  value: string | null,
  fromDate: string,
  toDate: string,
) {
  if (!value) return true;

  if (fromDate && value < fromDate) return false;
  if (toDate && value > toDate) return false;

  return true;
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

  return `${formatAmount(value)}%`;
}

async function getInvoiceCosts(restaurantId: string) {
  const supabase = getSupabaseClient();

  return supabase
    .from("invoice_items")
    .select(
      `
        cost_category_id,
        total_price,
        invoices (
          invoice_date
        )
      `,
    )
    .eq("restaurant_id", restaurantId);
}

async function getSalesWithMenuClassification(restaurantId: string) {
  const supabase = getSupabaseClient();

  const classifiedResult = await supabase
    .from("sales")
    .select(
      `
        sale_date,
        revenue,
        menu_items (
          category,
          type
        )
      `,
    )
    .eq("restaurant_id", restaurantId);

  if (!classifiedResult.error) {
    return classifiedResult;
  }

  return supabase
    .from("sales")
    .select("sale_date, revenue")
    .eq("restaurant_id", restaurantId);
}

export async function CostReportPage({
  costType,
  searchParams,
  title,
}: CostReportPageProps & {
  searchParams?: Promise<{
    from_date?: string;
    to_date?: string;
  }>;
}) {
  const params = await searchParams;
  const fromDate = params?.from_date ?? "";
  const toDate = params?.to_date ?? "";
  const restaurantId = await getCurrentUserRestaurantId().catch(
    (caughtError: Error) => {
      console.error(caughtError);
      return null;
    },
  );
  const { data: invoiceCostData, error: invoiceCostError } =
    restaurantId
      ? await getInvoiceCosts(restaurantId).catch((caughtError: Error) => ({
          data: null,
          error: caughtError,
        }))
      : { data: null, error: new Error("No restaurant profile found for this user.") };
  const { data: salesData, error: salesError } =
    restaurantId
      ? await getSalesWithMenuClassification(restaurantId).catch(
          (caughtError: Error) => ({
            data: null,
            error: caughtError,
          }),
        )
      : { data: null, error: new Error("No restaurant profile found for this user.") };

  const invoiceCosts = ((invoiceCostData ?? []) as InvoiceCostRow[]).filter(
    (row) => {
      const invoice = getRelatedItem(row.invoices);

      return (
        row.cost_category_id === costCategoryIds[costType] &&
        isInDateRange(invoice?.invoice_date ?? null, fromDate, toDate)
      );
    },
  );
  const salesRows = ((salesData ?? []) as SaleRow[]).filter((row) => {
    const menuItem = getRelatedItem(row.menu_items);
    const menuItemType = menuItem?.type ?? menuItem?.category ?? null;

    if (!isInDateRange(row.sale_date, fromDate, toDate)) {
      return false;
    }

    if (!menuItemType) {
      return true;
    }

    return menuItemType === costType;
  });
  const totalCost = invoiceCosts.reduce(
    (sum, row) => sum + (row.total_price ?? 0),
    0,
  );
  const totalSales = salesRows.reduce(
    (sum, row) => sum + (row.revenue ?? 0),
    0,
  );
  const costPercent = totalSales ? (totalCost / totalSales) * 100 : null;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>Cost report from invoice items and sales.</p>
        </div>
      </div>

      {invoiceCostError ? (
        <div className="error-state">
          <strong>Could not load invoice costs.</strong>
          <p>{invoiceCostError.message}</p>
        </div>
      ) : null}

      {salesError ? (
        <div className="error-state">
          <strong>Could not load sales.</strong>
          <p>{salesError.message}</p>
        </div>
      ) : null}

      <form className="form-card kpi-filters">
        <label>
          From date
          <input defaultValue={fromDate} name="from_date" type="date" />
        </label>

        <label>
          To date
          <input defaultValue={toDate} name="to_date" type="date" />
        </label>

        <button className="button" type="submit">
          Apply filters
        </button>
      </form>

      <div className="summary-grid">
        <div className="summary-card">
          <span className="label">Total cost</span>
          <span className="value">{formatAmount(totalCost)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Total sales</span>
          <span className="value">{formatAmount(totalSales)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Cost %</span>
          <span className="value">{formatPercent(costPercent)}</span>
        </div>
      </div>
    </main>
  );
}
