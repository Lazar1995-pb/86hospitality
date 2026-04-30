import { getSupabaseClient } from "@/lib/supabase";
import { SalesForm } from "./sales-form";

type MenuItem = {
  id: number;
  name: string | null;
  selling_price: number | null;
};

type Sale = {
  id: number;
  sale_date: string | null;
  quantity: number | null;
  revenue: number | null;
  note: string | null;
  menu_items:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
};

async function getMenuItems() {
  const supabase = getSupabaseClient();

  return supabase
    .from("menu_items")
    .select("id, name, selling_price")
    .eq("restaurant_id", 1)
    .order("name", { ascending: true });
}

async function getSales() {
  const supabase = getSupabaseClient();

  return supabase
    .from("sales")
    .select(
      `
        id,
        sale_date,
        quantity,
        revenue,
        note,
        menu_items (
          name
        )
      `,
    )
    .eq("restaurant_id", 1)
    .order("sale_date", { ascending: false });
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getMenuItemName(menuItem: Sale["menu_items"]): string | null {
  if (Array.isArray(menuItem)) {
    return menuItem[0]?.name ?? null;
  }

  return menuItem?.name ?? null;
}

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    from_date?: string;
    to_date?: string;
  }>;
}) {
  const params = await searchParams;
  const {
    data: menuItemData,
    error: menuItemError,
  } = await getMenuItems().catch((caughtError: Error) => ({
    data: null,
    error: caughtError,
  }));
  const { data: salesData, error: salesError } = await getSales().catch(
    (caughtError: Error) => ({
      data: null,
      error: caughtError,
    }),
  );
  const menuItems = (menuItemData ?? []) as MenuItem[];
  const fromDate = params?.from_date ?? "";
  const toDate = params?.to_date ?? "";
  const sales = ((salesData ?? []) as Sale[]).filter((sale) => {
    if (!sale.sale_date) return true;

    const date = new Date(sale.sale_date);

    if (fromDate && date < new Date(fromDate)) return false;
    if (toDate && date > new Date(toDate)) return false;

    return true;
  });
  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.revenue ?? 0), 0);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Sales</h1>
          <p>Daily sales input will be here.</p>
        </div>
      </div>

      {menuItemError ? (
        <div className="error-state">
          <strong>Could not load menu items.</strong>
          <p>{menuItemError.message}</p>
        </div>
      ) : null}

      {salesError ? (
        <div className="error-state">
          <strong>Could not load sales.</strong>
          <p>{salesError.message}</p>
        </div>
      ) : null}

      {params?.error ? (
        <div className="error-state">
          <strong>Could not save sale.</strong>
          <p>{params.error}</p>
        </div>
      ) : null}

      <SalesForm menuItems={menuItems} />

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

      {sales.length > 0 ? (
        <div className="summary-grid">
          <div className="summary-card">
            <span className="label">Total revenue</span>
            <span className="value">{formatAmount(totalRevenue)}</span>
          </div>
        </div>
      ) : null}

      {sales.length === 0 && !salesError ? (
        <div className="empty-state">No sales yet.</div>
      ) : null}

      {sales.length > 0 ? (
        <table className="items-table inventory-table">
          <thead>
            <tr>
              <th>Date</th>
              <th className="number">Revenue</th>
              <th>Note</th>
              <th>Menu item</th>
              <th className="number">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{formatDate(sale.sale_date)}</td>
                <td className="number">{formatAmount(sale.revenue)}</td>
                <td>{sale.note ?? "-"}</td>
                <td>{getMenuItemName(sale.menu_items) ?? "Manual daily sale"}</td>
                <td className="number">{formatAmount(sale.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
