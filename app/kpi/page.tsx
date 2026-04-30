import { getSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { createKpiCategory } from "./actions";
import { KpiCategoryManager } from "./kpi-category-manager";

type MonthlySummary = {
  month: string | null;
  revenue: number | null;
  actual_cost: number | null;
  cost_percent: number | null;
};

type CategorySummary = {
  category_id: number | null;
  month: string | null;
  category: string | null;
  total_cost: number | null;
};

type InvoiceItemCategoryRow = {
  cost_categories: { name: string | null } | { name: string | null }[] | null;
  cost_category_id: number | null;
  invoices: { invoice_date: string | null } | { invoice_date: string | null }[] | null;
  total_price: number | null;
};

type SalesProfitRow = {
  sale_date: string | null;
  revenue: number | null;
  theoretical_cost: number | null;
  gross_profit: number | null;
  gross_profit_percent: number | null;
};

type CostCategory = {
  id: number;
  name: string | null;
};

type UserProfile = {
  restaurant_id: number | null;
};

type Filters = {
  categoryId: string;
  categoryName: string;
  fromDate: string;
  grouping: "daily" | "weekly" | "monthly";
  toDate: string;
};

async function getMonthlySummary(restaurantId: number) {
  const supabase = getSupabaseClient();

  return supabase
    .from("dashboard_monthly_summary")
    .select("month, revenue, actual_cost, cost_percent")
    .eq("restaurant_id", restaurantId)
    .order("month", { ascending: false });
}

async function getCategorySummary(restaurantId: number) {
  const supabase = getSupabaseClient();

  return supabase
    .from("invoice_items")
    .select(
      `
        cost_category_id,
        total_price,
        cost_categories (
          name
        ),
        invoices!inner (
          invoice_date
        )
      `,
    )
    .eq("restaurant_id", restaurantId);
}

async function getSalesProfitReport(restaurantId: number) {
  const supabase = getSupabaseClient();

  return supabase
    .from("sales_profit_report")
    .select("sale_date, revenue, theoretical_cost, gross_profit, gross_profit_percent")
    .eq("restaurant_id", restaurantId);
}

async function getRestaurantId() {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    console.error("Could not load authenticated user:", userError);
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("restaurant_id")
    .eq("auth_user_id", userData.user.id)
    .single();

  if (profileError || !(profile as UserProfile | null)?.restaurant_id) {
    console.error("Could not load user profile:", profileError);
    return null;
  }

  return (profile as UserProfile).restaurant_id;
}

async function getCostCategories(restaurantId: number) {
  const supabase = getSupabaseClient();

  return supabase
    .from("cost_categories")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true });
}

function getDateValue(value: string | null) {
  if (!value) return null;

  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function isInDateRange(value: string | null, filters: Filters) {
  const date = getDateValue(value);
  if (!date) return true;

  if (filters.fromDate && date < new Date(filters.fromDate)) return false;
  if (filters.toDate && date > new Date(filters.toDate)) return false;

  return true;
}

function getPeriod(value: string | null, grouping: Filters["grouping"]) {
  const date = getDateValue(value);
  if (!date) return "Unknown";

  if (grouping === "daily") {
    return date.toISOString().slice(0, 10);
  }

  if (grouping === "weekly") {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + 1);

    return weekStart.toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 7);
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

function isUncategorizedCategory(value: string | null) {
  return !value || !value.trim() || value.trim() === "-";
}

function getCategoryLabel(value: string | null) {
  return isUncategorizedCategory(value) ? "Uncategorized" : value ?? "Uncategorized";
}

function getSingleJoinValue<T>(value: T | T[] | null) {
  if (Array.isArray(value)) return value[0] ?? null;

  return value;
}

function mapCategorySummary(rows: InvoiceItemCategoryRow[]) {
  return rows.map((row) => {
    const invoice = getSingleJoinValue(row.invoices);
    const category = getSingleJoinValue(row.cost_categories);

    return {
      category: row.cost_category_id ? category?.name ?? null : null,
      category_id: row.cost_category_id,
      month: invoice?.invoice_date ?? null,
      total_cost: row.total_price ?? 0,
    };
  });
}

export const dynamic = "force-dynamic";

export default async function KpiPage({
  searchParams,
}: {
  searchParams?: Promise<{
    category_error?: string;
    category_id?: string;
    category_message?: string;
    from_date?: string;
    grouping?: string;
    to_date?: string;
  }>;
}) {
  const params = await searchParams;
  const restaurantId = await getRestaurantId();
  const { data: monthlyData, error: monthlyError } =
    restaurantId
      ? await getMonthlySummary(restaurantId).catch((caughtError: Error) => ({
          data: null,
          error: caughtError,
        }))
      : {
          data: null,
          error: new Error("No restaurant profile found."),
        };
  const { data: categoryData, error: categoryError } =
    restaurantId
      ? await getCategorySummary(restaurantId).catch((caughtError: Error) => ({
          data: null,
          error: caughtError,
        }))
      : {
          data: null,
          error: new Error("No restaurant profile found."),
        };
  const { data: profitData, error: profitError } =
    restaurantId
      ? await getSalesProfitReport(restaurantId).catch((caughtError: Error) => ({
          data: null,
          error: caughtError,
        }))
      : {
          data: null,
          error: new Error("No restaurant profile found."),
        };
  const { data: costCategoryData, error: costCategoryError } =
    restaurantId
      ? await getCostCategories(restaurantId).catch((caughtError: Error) => ({
          data: null,
          error: caughtError,
        }))
      : {
          data: null,
          error: new Error("No restaurant profile found."),
        };

  const monthlySummary = (monthlyData ?? []) as MonthlySummary[];
  const categorySummary = mapCategorySummary(
    (categoryData ?? []) as InvoiceItemCategoryRow[],
  );
  const profitRows = (profitData ?? []) as SalesProfitRow[];
  const costCategories = (costCategoryData ?? []) as CostCategory[];
  const requestedCategoryId = params?.category_id ?? "";
  const selectedCategory = costCategories.find(
    (category) => String(category.id) === requestedCategoryId,
  );
  const requestedGrouping = params?.grouping;
  const filters: Filters = {
    categoryId: requestedCategoryId,
    categoryName:
      requestedCategoryId === "uncategorized"
        ? "Uncategorized"
        : selectedCategory?.name ?? "",
    fromDate: params?.from_date ?? "",
    grouping:
      requestedGrouping === "daily" || requestedGrouping === "weekly"
        ? requestedGrouping
        : "monthly",
    toDate: params?.to_date ?? "",
  };
  const filteredMonthlySummary = monthlySummary.filter((row) =>
    isInDateRange(row.month, filters),
  );
  const groupedMonthlySummary = Object.values(
    filteredMonthlySummary.reduce<Record<string, MonthlySummary>>((acc, row) => {
      const period = getPeriod(row.month, filters.grouping);
      const current = acc[period] ?? {
        actual_cost: 0,
        cost_percent: 0,
        month: period,
        revenue: 0,
      };
      const revenue = (current.revenue ?? 0) + (row.revenue ?? 0);
      const actualCost = (current.actual_cost ?? 0) + (row.actual_cost ?? 0);

      acc[period] = {
        actual_cost: actualCost,
        cost_percent: revenue ? (actualCost / revenue) * 100 : null,
        month: period,
        revenue,
      };

      return acc;
    }, {}),
  );
  const filteredCategorySummary = categorySummary.filter((row) => {
    if (!isInDateRange(row.month, filters)) return false;
    if (filters.categoryId === "uncategorized") {
      return !row.category_id;
    }

    return !filters.categoryId || String(row.category_id) === filters.categoryId;
  });
  const groupedCategorySummary = Object.values(
    filteredCategorySummary.reduce<Record<string, CategorySummary>>(
      (acc, row) => {
        const period = getPeriod(row.month, filters.grouping);
        const categoryLabel = getCategoryLabel(row.category);
        const key = `${period}-${categoryLabel}`;
        const current = acc[key] ?? {
          category: categoryLabel,
          category_id: row.category_id,
          month: period,
          total_cost: 0,
        };

        acc[key] = {
          category: categoryLabel,
          category_id: row.category_id,
          month: period,
          total_cost: (current.total_cost ?? 0) + (row.total_cost ?? 0),
        };

        return acc;
      },
      {},
    ),
  );
  const filteredProfitRows = profitRows.filter((row) =>
    isInDateRange(row.sale_date, filters),
  );
  const totalRevenue = filteredProfitRows.reduce(
    (sum, row) => sum + (row.revenue ?? 0),
    0,
  );
  const totalTheoreticalCost = filteredProfitRows.reduce(
    (sum, row) => sum + (row.theoretical_cost ?? 0),
    0,
  );
  const totalGrossProfit = filteredProfitRows.reduce(
    (sum, row) => sum + (row.gross_profit ?? 0),
    0,
  );
  const rowsWithGrossProfitPercent = filteredProfitRows.filter(
    (row) => row.gross_profit_percent !== null,
  );
  const averageGrossProfitPercent =
    rowsWithGrossProfitPercent.length > 0
      ? rowsWithGrossProfitPercent.reduce(
          (sum, row) => sum + (row.gross_profit_percent ?? 0),
          0,
        ) / rowsWithGrossProfitPercent.length
      : null;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>KPI Dashboard</h1>
          <p>Simple management dashboard.</p>
        </div>
      </div>

      {monthlyError ? (
        <div className="error-state">
          <strong>Could not load monthly summary.</strong>
          <p>{monthlyError.message}</p>
        </div>
      ) : null}

      {categoryError ? (
        <div className="error-state">
          <strong>Could not load category cost summary.</strong>
          <p>{categoryError.message}</p>
        </div>
      ) : null}

      {profitError ? (
        <div className="error-state">
          <strong>Could not load profit summary.</strong>
          <p>{profitError.message}</p>
        </div>
      ) : null}

      {costCategoryError ? (
        <div className="error-state">
          <strong>Could not load categories.</strong>
          <p>{costCategoryError.message}</p>
        </div>
      ) : null}

      {params?.category_error ? (
        <div className="error-state">
          <strong>Could not create KPI category.</strong>
          <p>{params.category_error}</p>
        </div>
      ) : null}

      {params?.category_message ? (
        <div className="empty-state">{params.category_message}</div>
      ) : null}

      <form className="form-card kpi-filters">
        <label>
          From date
          <input
            defaultValue={filters.fromDate}
            name="from_date"
            type="date"
          />
        </label>

        <label>
          To date
          <input defaultValue={filters.toDate} name="to_date" type="date" />
        </label>

        <label>
          Category
          <select defaultValue={filters.categoryId} name="category_id">
            <option value="">All categories</option>
            <option value="uncategorized">Uncategorized</option>
            {costCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name ?? `Category ${category.id}`}
              </option>
            ))}
          </select>
        </label>

        <label>
          Period grouping
          <select defaultValue={filters.grouping} name="grouping">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        <button className="button" type="submit">
          Apply filters
        </button>
      </form>

      <form action={createKpiCategory} className="form-card kpi-filters">
        <input name="from_date" type="hidden" value={filters.fromDate} />
        <input name="to_date" type="hidden" value={filters.toDate} />
        <input name="grouping" type="hidden" value={filters.grouping} />

        <label>
          New KPI category
          <input name="category_name" type="text" />
        </label>

        <button className="button" type="submit">
          Add category
        </button>
      </form>

      <KpiCategoryManager categories={costCategories} />

      <div className="summary-grid">
        <div className="summary-card">
          <span className="label">Total revenue</span>
          <span className="value">{formatAmount(totalRevenue)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Total theoretical cost</span>
          <span className="value">{formatAmount(totalTheoreticalCost)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Total gross profit</span>
          <span className="value">{formatAmount(totalGrossProfit)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Average gross profit %</span>
          <span className="value">{formatPercent(averageGrossProfitPercent)}</span>
        </div>
      </div>

      <section className="dashboard-section">
        <h2>Monthly summary</h2>
        {groupedMonthlySummary.length > 0 ? (
          <table className="items-table inventory-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="number">Revenue</th>
                <th className="number">Actual cost</th>
                <th className="number">Cost %</th>
              </tr>
            </thead>
            <tbody>
              {groupedMonthlySummary.map((row, index) => (
                <tr key={`${row.month}-${index}`}>
                  <td>{row.month ?? "-"}</td>
                  <td className="number">{formatAmount(row.revenue)}</td>
                  <td className="number">{formatAmount(row.actual_cost)}</td>
                  <td className="number">{formatPercent(row.cost_percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !monthlyError ? (
          <div className="empty-state">No monthly summary yet.</div>
        ) : null}
      </section>

      <section className="dashboard-section">
        <h2>Category cost summary</h2>
        {groupedCategorySummary.length > 0 ? (
          <table className="items-table inventory-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Category</th>
                <th className="number">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {groupedCategorySummary.map((row, index) => (
                <tr key={`${row.month}-${row.category}-${index}`}>
                  <td>{row.month ?? "-"}</td>
                  <td>{getCategoryLabel(row.category)}</td>
                  <td className="number">{formatAmount(row.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !categoryError ? (
          <div className="empty-state">No category cost summary yet.</div>
        ) : null}
      </section>
    </main>
  );
}
