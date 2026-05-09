"use client";

import { DashboardChartCard } from "@/components/dashboard/DashboardChartCard";
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { DepartmentSummaryCard } from "@/components/dashboard/DepartmentSummaryCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LoadingState } from "@/components/dashboard/LoadingState";
import { LowStockAlerts } from "@/components/dashboard/LowStockAlerts";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import {
  type DashboardCurrency,
  dashboardCurrencies,
  formatMoney,
} from "@/lib/format-money";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type UserProfile = {
  restaurant_id: string | null;
};

type Sale = {
  category: string | null;
  created_at: string | null;
  id: number | string;
  menu_item_id: number | string | null;
  quantity: number | null;
  revenue: number | null;
  sale_date: string | null;
};

type Invoice = {
  created_at: string | null;
  id: number | string;
  invoice_date: string | null;
  invoice_number: string | null;
  total: number | null;
};

type InvoiceItem = {
  cost_categories: { name: string | null } | { name: string | null }[] | null;
  invoices:
    | { created_at: string | null; invoice_date: string | null }
    | { created_at: string | null; invoice_date: string | null }[]
    | null;
  total_price: number | null;
};

type InventoryItem = {
  active: boolean | null;
  base_unit_cost: number | null;
  created_at: string | null;
  id: number | string;
  minimum_stock: number | null;
  name: string | null;
};

type Employee = {
  active: boolean | null;
  created_at: string | null;
  department: string | null;
  id: number | string;
  full_name: string | null;
};

type Recipe = {
  active: boolean | null;
  cost_per_unit: number | null;
  id: number | string;
  name: string | null;
  total_cost: number | null;
};

type EmployeeDocument = {
  employee_id: number | string | null;
  expiry_date: string | null;
  id: number | string;
  status: string | null;
};

type DashboardData = {
  documents: EmployeeDocument[];
  employees: Employee[];
  inventoryItems: InventoryItem[];
  invoiceItems: InvoiceItem[];
  invoices: Invoice[];
  laborCostEntries: LaborCostEntry[];
  recipes: Recipe[];
  sales: Sale[];
};

type LaborCostEntry = {
  department: string | null;
  period_end: string | null;
  period_start: string | null;
  total_labor_cost: number | null;
};

type RestaurantSettings = {
  currency: DashboardCurrency | null;
};

type ActivityItem = {
  date?: string | null;
  detail: string;
  title: string;
};

type AlertItem = {
  detail: string;
  title: string;
  tone?: "warning" | "danger" | "neutral";
};

type PeriodOption =
  | "today"
  | "7-days"
  | "30-days"
  | "this-month"
  | "last-month"
  | "this-year"
  | "custom";

const periodOptions: Array<{ label: string; value: PeriodOption }> = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7-days" },
  { label: "30 days", value: "30-days" },
  { label: "This month", value: "this-month" },
  { label: "Last month", value: "last-month" },
  { label: "This year", value: "this-year" },
  { label: "Custom range", value: "custom" },
];

function asArrayRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;

  return value ?? null;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";

  return `${value.toFixed(1)}%`;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function getPeriodRange(
  period: PeriodOption,
  customFrom: string,
  customTo: string,
) {
  const now = new Date();
  const today = startOfDay(now);

  if (period === "today") {
    return { from: today, to: endOfDay(now) };
  }

  if (period === "7-days" || period === "30-days") {
    const days = period === "7-days" ? 6 : 29;
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    return { from, to: endOfDay(now) };
  }

  if (period === "this-month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: endOfDay(now),
    };
  }

  if (period === "last-month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }

  if (period === "this-year") {
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: endOfDay(now),
    };
  }

  return {
    from: customFrom ? startOfDay(new Date(customFrom)) : null,
    to: customTo ? endOfDay(new Date(customTo)) : null,
  };
}

function isWithinRange(
  value: string | null | undefined,
  range: { from: Date | null; to: Date | null },
) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function getCategoryName(item: InvoiceItem) {
  return asArrayRelation(item.cost_categories)?.name?.toLowerCase() ?? "";
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>(
    (total, value) => total + (Number(value) || 0),
    0,
  );
}

function groupRevenueByDate(sales: Sale[], mode: "daily" | "weekly" | "monthly") {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: mode === "monthly" ? undefined : "2-digit",
    month: "short",
  });
  const grouped = new Map<string, number>();

  sales.forEach((sale) => {
    if (!sale.sale_date) return;

    const date = new Date(sale.sale_date);
    const label =
      mode === "weekly"
        ? `Week ${getWeekNumber(date)}`
        : mode === "monthly"
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              year: "2-digit",
            }).format(date)
          : formatter.format(date);

    grouped.set(label, (grouped.get(label) ?? 0) + (sale.revenue ?? 0));
  });

  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, value }))
    .slice(-8);
}

function getWeekNumber(date: Date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOffset = Math.floor(
    (date.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000),
  );

  return Math.ceil((dayOffset + firstDay.getDay() + 1) / 7);
}

function getDocumentAlerts(documents: EmployeeDocument[]): AlertItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return documents.flatMap<AlertItem>((document) => {
    if (!document.expiry_date) return [];

    const expiry = new Date(document.expiry_date);
    expiry.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil(
      (expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (daysLeft < 0 || document.status === "expired") {
      return [{
        detail: `Expired ${Math.abs(daysLeft)} day(s) ago.`,
        title: "Expired employee document",
        tone: "danger" as const,
      }];
    }

    if (daysLeft <= 30) {
      return [{
        detail: `Expires in ${daysLeft} day(s).`,
        title: "Upcoming employee document expiration",
        tone: "warning" as const,
      }];
    }

    return [];
  });
}

export function DashboardClient() {
  const router = useRouter();
  const [currency, setCurrency] = useState<DashboardCurrency>("EUR");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodOption>("30-days");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Could not load dashboard user:", userError.message);
      setError(userError.message);
      setIsLoading(false);
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("users_profiles")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .limit(1);

    if (profileError) {
      console.error("Could not load dashboard profile:", profileError.message);
      setError(profileError.message);
      setIsLoading(false);
      return;
    }

    const restaurantId = ((profiles?.[0] ?? null) as UserProfile | null)
      ?.restaurant_id;

    if (!restaurantId) {
      setError("No restaurant profile found for this user.");
      setIsLoading(false);
      return;
    }

    const { data: restaurantSettings, error: restaurantSettingsError } =
      await supabase
        .from("restaurants")
        .select("currency")
        .eq("id", restaurantId)
        .maybeSingle();

    if (restaurantSettingsError) {
      console.error(
        "Could not load restaurant currency:",
        restaurantSettingsError.message,
      );
    } else {
      const nextCurrency = (restaurantSettings as RestaurantSettings | null)
        ?.currency;

      if (nextCurrency && dashboardCurrencies.includes(nextCurrency)) {
        setCurrency(nextCurrency);
      }
    }

    const [
      salesResult,
      invoicesResult,
      invoiceItemsResult,
      inventoryResult,
      employeesResult,
      recipesResult,
      documentsResult,
      laborResult,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("id, category, menu_item_id, quantity, revenue, sale_date, created_at")
        .eq("restaurant_id", restaurantId)
        .order("sale_date", { ascending: true }),
      supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total, created_at")
        .eq("restaurant_id", restaurantId)
        .order("invoice_date", { ascending: true }),
      supabase
        .from("invoice_items")
        .select("total_price, cost_categories(name), invoices(invoice_date, created_at)")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("inventory_items")
        .select("id, name, base_unit_cost, minimum_stock, active, created_at")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("employees")
        .select("id, full_name, department, active, created_at")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("recipes")
        .select("id, name, total_cost, cost_per_unit, active")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("employee_documents")
        .select("id, employee_id, expiry_date, status")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("labor_cost_entries")
        .select("department, period_start, period_end, total_labor_cost")
        .eq("restaurant_id", restaurantId),
    ]);

    const queryErrors = [
      salesResult.error,
      invoicesResult.error,
      invoiceItemsResult.error,
      inventoryResult.error,
      employeesResult.error,
      recipesResult.error,
      documentsResult.error,
      laborResult.error,
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      queryErrors.forEach((queryError) =>
        console.error("Could not load dashboard data:", queryError?.message),
      );
    }

    setData({
      documents: (documentsResult.data ?? []) as EmployeeDocument[],
      employees: (employeesResult.data ?? []) as Employee[],
      inventoryItems: (inventoryResult.data ?? []) as InventoryItem[],
      invoiceItems: (invoiceItemsResult.data ?? []) as InvoiceItem[],
      invoices: (invoicesResult.data ?? []) as Invoice[],
      laborCostEntries: (laborResult.data ?? []) as LaborCostEntry[],
      recipes: (recipesResult.data ?? []) as Recipe[],
      sales: (salesResult.data ?? []) as Sale[],
    });
    setError(queryErrors[0]?.message ?? "");
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const periodRange = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [customFrom, customTo, period],
  );

  const filteredData = useMemo<DashboardData | null>(() => {
    if (!data) return null;

    return {
      documents: data.documents.filter((document) =>
        isWithinRange(document.expiry_date, periodRange),
      ),
      employees: data.employees.filter((employee) =>
        isWithinRange(employee.created_at, periodRange),
      ),
      inventoryItems: data.inventoryItems.filter((item) =>
        isWithinRange(item.created_at, periodRange),
      ),
      invoiceItems: data.invoiceItems.filter((item) => {
        const invoice = asArrayRelation(item.invoices);
        return isWithinRange(
          invoice?.invoice_date ?? invoice?.created_at,
          periodRange,
        );
      }),
      invoices: data.invoices.filter((invoice) =>
        isWithinRange(invoice.invoice_date ?? invoice.created_at, periodRange),
      ),
      laborCostEntries: data.laborCostEntries.filter((entry) => {
        if (!entry.period_start && !entry.period_end) return false;
        if (periodRange.from && entry.period_end) {
          const periodEnd = new Date(entry.period_end);
          if (periodEnd < periodRange.from) return false;
        }
        if (periodRange.to && entry.period_start) {
          const periodStart = new Date(entry.period_start);
          if (periodStart > periodRange.to) return false;
        }
        return true;
      }),
      recipes: data.recipes,
      sales: data.sales.filter((sale) =>
        isWithinRange(sale.sale_date ?? sale.created_at, periodRange),
      ),
    };
  }, [data, periodRange]);

  const metrics = useMemo(() => {
    const sales = filteredData?.sales ?? [];
    const invoices = filteredData?.invoices ?? [];
    const invoiceItems = filteredData?.invoiceItems ?? [];
    const inventoryItems = data?.inventoryItems ?? [];
    const employees = data?.employees ?? [];
    const laborCostEntries = filteredData?.laborCostEntries ?? [];

    const totalRevenue = sum(sales.map((sale) => sale.revenue));
    const totalPurchases = sum(invoices.map((invoice) => invoice.total));
    const foodCost = sum(
      invoiceItems
        .filter((item) => getCategoryName(item).includes("food"))
        .map((item) => item.total_price),
    );
    const beverageCost = sum(
      invoiceItems
        .filter((item) => {
          const categoryName = getCategoryName(item);
          return categoryName.includes("beverage") || categoryName.includes("bar");
        })
        .map((item) => item.total_price),
    );
    const inventoryValue = sum(
      inventoryItems.map((item) => item.base_unit_cost ?? 0),
    );
    const grossProfit = totalRevenue - foodCost - beverageCost;
    const laborCost = sum(laborCostEntries.map((entry) => entry.total_labor_cost));

    return {
      activeEmployees: employees.filter((employee) => employee.active !== false),
      beverageCost,
      beverageCostPercent: totalRevenue ? (beverageCost / totalRevenue) * 100 : null,
      foodCost,
      foodCostPercent: totalRevenue ? (foodCost / totalRevenue) * 100 : null,
      grossProfit: grossProfit - laborCost,
      inventoryValue,
      laborCost,
      totalPurchases,
      totalRevenue,
    };
  }, [data?.employees, data?.inventoryItems, filteredData]);

  const activityItems = useMemo<ActivityItem[]>(() => {
    if (!filteredData) return [];

    return [
      ...filteredData.invoices.slice(-4).map((invoice) => ({
        date: invoice.invoice_date ?? invoice.created_at,
        detail: `${invoice.invoice_number ?? "Invoice"} - ${formatMoney(invoice.total ?? 0, currency)}`,
        title: "Invoice added",
      })),
      ...filteredData.sales.slice(-4).map((sale) => ({
        date: sale.sale_date ?? sale.created_at,
        detail: formatMoney(sale.revenue ?? 0, currency),
        title: "Sales entry",
      })),
      ...filteredData.inventoryItems.slice(-3).map((item) => ({
        date: item.created_at,
        detail: item.name ?? "Inventory item",
        title: "Inventory update",
      })),
      ...filteredData.employees.slice(-3).map((employee) => ({
        date: employee.created_at,
        detail: employee.full_name ?? "Employee",
        title: "Employee activity",
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
      )
      .slice(0, 8);
  }, [currency, filteredData]);

  const alerts = useMemo(() => {
    if (!data) return [];

    const lowStockAlerts = data.inventoryItems
      .filter((item) => item.active !== false && (item.minimum_stock ?? 0) > 0)
      .slice(0, 5)
      .map((item) => ({
        detail: `Minimum stock target: ${item.minimum_stock}. Add current stock counts to make this alert precise.`,
        title: item.name ?? "Low stock item",
        tone: "warning" as const,
      }));
    const missingDocuments = data.employees
      .filter(
        (employee) =>
          employee.active !== false &&
          !data.documents.some((document) => document.employee_id === employee.id),
      )
      .slice(0, 5)
      .map((employee) => ({
        detail: "No document records found.",
        title: employee.full_name ?? "Employee missing documents",
        tone: "neutral" as const,
      }));

    return [
      ...lowStockAlerts,
      ...missingDocuments,
      ...getDocumentAlerts(data.documents),
    ].slice(0, 10);
  }, [data]);

  if (isLoading) return <LoadingState />;

  if (!data) {
    return (
      <main>
        <EmptyState
          text={error || "Connect restaurant data to start using the dashboard."}
          title="Dashboard unavailable"
        />
      </main>
    );
  }

  const money = (value: number) => formatMoney(value, currency);
  const hasPeriodData = Boolean(
    filteredData &&
      (filteredData.sales.length > 0 ||
        filteredData.invoices.length > 0 ||
        filteredData.invoiceItems.length > 0 ||
        filteredData.laborCostEntries.length > 0 ||
        filteredData.inventoryItems.length > 0 ||
        filteredData.employees.length > 0),
  );
  const splitData = [
    { label: "Food", value: metrics.foodCost },
    { label: "Beverage", value: metrics.beverageCost },
  ];

  return (
    <main className="dashboard-page">
      <div className="dashboard-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Owner overview for sales, costs, team, inventory, and alerts.</p>
        </div>
        {error ? <span className="dashboard-soft-error">{error}</span> : null}
      </div>

      <section className="dashboard-control-bar">
        <label>
          Period
          <select
            onChange={(event) => setPeriod(event.target.value as PeriodOption)}
            value={period}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {period === "custom" ? (
          <div className="dashboard-custom-range">
            <label>
              From
              <input
                onChange={(event) => setCustomFrom(event.target.value)}
                type="date"
                value={customFrom}
              />
            </label>
            <label>
              To
              <input
                onChange={(event) => setCustomTo(event.target.value)}
                type="date"
                value={customTo}
              />
            </label>
          </div>
        ) : null}

        <div className="dashboard-currency-badge">Currency: {currency}</div>
      </section>

      {!hasPeriodData ? (
        <EmptyState
          text="Try another period or add sales, invoices, inventory, or employee data."
          title="No data for selected period"
        />
      ) : null}

      <div className="dashboard-grid kpi-grid">
        <DashboardKpiCard
          icon={currency}
          title="Total revenue"
          trend="Current restaurant data"
          value={money(metrics.totalRevenue)}
        />
        <DashboardKpiCard
          title="Total food cost"
          trend="From invoice item categories"
          value={money(metrics.foodCost)}
        />
        <DashboardKpiCard
          title="Total beverage cost"
          trend="From beverage/bar categories"
          value={money(metrics.beverageCost)}
        />
        <DashboardKpiCard
          title="Food cost %"
          trend="Food cost / revenue"
          value={formatPercent(metrics.foodCostPercent)}
        />
        <DashboardKpiCard
          title="Beverage cost %"
          trend="Beverage cost / revenue"
          value={formatPercent(metrics.beverageCostPercent)}
        />
        <DashboardKpiCard
          title="Total purchases"
          trend="Invoice totals"
          value={money(metrics.totalPurchases)}
        />
        <DashboardKpiCard
          title="Labor cost"
          trend="From labor cost entries"
          value={money(metrics.laborCost)}
        />
        <DashboardKpiCard
          title="Gross profit"
          trend="Revenue minus food and beverage cost"
          value={money(metrics.grossProfit)}
        />
      </div>

      <div className="dashboard-grid dashboard-two-column">
        <DashboardChartCard
          data={groupRevenueByDate(filteredData?.sales ?? [], "daily")}
          title="Daily revenue"
          valueFormatter={money}
        />
        <DashboardChartCard
          data={groupRevenueByDate(filteredData?.sales ?? [], "weekly")}
          title="Weekly revenue"
          valueFormatter={money}
        />
        <DashboardChartCard
          data={groupRevenueByDate(filteredData?.sales ?? [], "monthly")}
          title="Monthly revenue"
          valueFormatter={money}
        />
        <DashboardChartCard
          data={splitData}
          emptyText="No categorized revenue split yet."
          title="Food vs Beverage split"
          valueFormatter={money}
        />
      </div>

      <section className="dashboard-card">
        <h2>Cost overview</h2>
        <div className="cost-overview-grid">
          <DashboardKpiCard
            title="Food purchases"
            trend="Invoice items tagged Food"
            value={money(metrics.foodCost)}
          />
          <DashboardKpiCard
            title="Beverage purchases"
            trend="Invoice items tagged Beverage or Bar"
            value={money(metrics.beverageCost)}
          />
          <DashboardKpiCard
            title="Inventory value"
            trend="Base unit costs available"
            value={money(metrics.inventoryValue)}
          />
          <DashboardKpiCard
            title="Waste/loss"
            trend="TODO: connect waste tracking"
            value="-"
          />
          <DashboardKpiCard
            title="Real food cost"
            trend="TODO: connect opening/closing inventory"
            value="-"
          />
          <DashboardKpiCard
            title="Theoretical food cost"
            trend="Recipe costs available"
            value={money(sum(data.recipes.map((recipe) => recipe.total_cost)))}
          />
        </div>
      </section>

      <div className="dashboard-grid dashboard-two-column">
        <RecentActivityFeed items={activityItems} />
        <QuickActions
          actions={[
            { href: "/invoices/new", label: "Add invoice" },
            { href: "/sales", label: "Add sale" },
            { href: "/inventory", label: "Add inventory item" },
            { href: "/employees", label: "Add employee" },
            { href: "/recipes", label: "Create recipe" },
          ]}
        />
      </div>

      <section className="dashboard-card">
        <h2>Department summary</h2>
        <div className="dashboard-grid department-grid">
          {["Kitchen", "Bar", "Front"].map((department) => {
            const departmentKey = department.toLowerCase();
            const employeesCount = metrics.activeEmployees.filter(
              (employee) => employee.department === departmentKey,
            ).length;
            const purchasesCost =
              departmentKey === "bar"
                ? metrics.beverageCost
                : departmentKey === "kitchen"
                  ? metrics.foodCost
                  : 0;
            const departmentRevenue =
              departmentKey === "bar"
                ? sum(
                    (filteredData?.sales ?? [])
                      .filter((sale) => sale.category === "beverage")
                      .map((sale) => sale.revenue),
                  )
                : departmentKey === "kitchen"
                  ? sum(
                      (filteredData?.sales ?? [])
                        .filter((sale) => sale.category === "food")
                        .map((sale) => sale.revenue),
                    )
                  : metrics.totalRevenue;
            const laborCost = sum(
              (filteredData?.laborCostEntries ?? [])
                .filter((entry) => entry.department === departmentKey)
                .map((entry) => entry.total_labor_cost),
            );
            const totalDepartmentCost = purchasesCost + laborCost;
            const profitAfterLabor =
              departmentRevenue - purchasesCost - laborCost;
            const laborPercent = departmentRevenue
              ? (laborCost / departmentRevenue) * 100
              : 0;

            return (
              <DepartmentSummaryCard
                employeesCount={employeesCount}
                key={department}
                laborCost={money(laborCost)}
                laborPercent={formatPercent(laborPercent)}
                name={department}
                profitAfterLabor={money(profitAfterLabor)}
                purchasesCost={money(purchasesCost)}
                revenue={money(departmentRevenue)}
                totalDepartmentCost={money(totalDepartmentCost)}
              />
            );
          })}
        </div>
      </section>

      <LowStockAlerts items={alerts} />
    </main>
  );
}
