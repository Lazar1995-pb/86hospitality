"use client";

import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { type DashboardCurrency, formatMoney } from "@/lib/format-money";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Department = "kitchen" | "bar" | "front";

type UserProfile = {
  restaurant_id: string | null;
};

type RestaurantSettings = {
  currency: DashboardCurrency | null;
};

type Employee = {
  department: string | null;
  full_name: string | null;
  id: number | string;
};

type LaborCostEntry = {
  bonus: number | null;
  deductions: number | null;
  department: Department;
  employee_id: number | string | null;
  employees?: { full_name: string | null } | { full_name: string | null }[] | null;
  fixed_salary: number | null;
  hourly_rate: number | null;
  id: number | string;
  notes: string | null;
  overtime_hours: number | null;
  overtime_rate: number | null;
  period_end: string;
  period_start: string;
  total_labor_cost: number | null;
  worked_hours: number | null;
};

type Sale = {
  category: string | null;
  revenue: number | null;
  sale_date: string | null;
};

const departments: Array<{ label: string; value: Department }> = [
  { label: "Kitchen", value: "kitchen" },
  { label: "Bar", value: "bar" },
  { label: "Front", value: "front" },
];

function getDefaultPeriodStart() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function getDefaultPeriodEnd() {
  return new Date().toISOString().slice(0, 10);
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (Number(value) || 0), 0);
}

function getEmployeeName(entry: LaborCostEntry, employees: Employee[]) {
  const relation = Array.isArray(entry.employees)
    ? entry.employees[0]
    : entry.employees;

  if (relation?.full_name) return relation.full_name;

  const employee = employees.find((item) => item.id === entry.employee_id);
  return employee?.full_name ?? "Employee";
}

export function LaborCostClient() {
  const router = useRouter();
  const [currency, setCurrency] = useState<DashboardCurrency>("EUR");
  const [department, setDepartment] = useState<Department>("kitchen");
  const [editingEntry, setEditingEntry] = useState<LaborCostEntry | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<LaborCostEntry[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [periodEnd, setPeriodEnd] = useState(getDefaultPeriodEnd());
  const [periodStart, setPeriodStart] = useState(getDefaultPeriodStart());
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);

  const loadRestaurantId = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Could not load labor cost user:", userError.message);
      setError(userError.message);
      return null;
    }

    if (!user) {
      router.replace("/login");
      return null;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("users_profiles")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .limit(1);

    if (profileError) {
      console.error("Could not load labor cost profile:", profileError.message);
      setError(profileError.message);
      return null;
    }

    const nextRestaurantId = ((profiles?.[0] ?? null) as UserProfile | null)
      ?.restaurant_id;

    if (!nextRestaurantId) {
      setError("No restaurant profile found.");
      return null;
    }

    setRestaurantId(nextRestaurantId);
    return nextRestaurantId;
  }, [router]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const nextRestaurantId = restaurantId ?? (await loadRestaurantId());

    if (!nextRestaurantId) {
      setIsLoading(false);
      return;
    }

    const [employeeResult, laborResult, restaurantResult, salesResult] =
      await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name, department")
        .eq("restaurant_id", nextRestaurantId)
        .eq("active", true)
        .eq("department", department)
        .order("full_name", { ascending: true }),
      supabase
        .from("labor_cost_entries")
        .select(
          "id, employee_id, department, period_start, period_end, hourly_rate, worked_hours, overtime_hours, overtime_rate, fixed_salary, bonus, deductions, total_labor_cost, notes, employees(full_name)",
        )
        .eq("restaurant_id", nextRestaurantId)
        .eq("department", department)
        .lte("period_start", periodEnd)
        .gte("period_end", periodStart)
        .order("period_start", { ascending: false }),
      supabase
        .from("restaurants")
        .select("currency")
        .eq("id", nextRestaurantId)
        .maybeSingle(),
      supabase
        .from("sales")
        .select("category, revenue, sale_date")
        .eq("restaurant_id", nextRestaurantId)
        .gte("sale_date", periodStart)
        .lte("sale_date", periodEnd),
    ]);

    if (employeeResult.error) {
      console.error("Could not load labor employees:", employeeResult.error.message);
    }

    if (laborResult.error) {
      console.error("Could not load labor entries:", laborResult.error.message);
    }

    if (restaurantResult.error) {
      console.error(
        "Could not load labor restaurant currency:",
        restaurantResult.error.message,
      );
    }

    if (salesResult.error) {
      console.error("Could not load labor sales:", salesResult.error.message);
    }

    const nextCurrency = (restaurantResult.data as RestaurantSettings | null)
      ?.currency;

    if (nextCurrency) setCurrency(nextCurrency);
    setEmployees((employeeResult.data ?? []) as Employee[]);
    setEntries((laborResult.data ?? []) as LaborCostEntry[]);
    setSales((salesResult.data ?? []) as Sale[]);
    setError(employeeResult.error?.message ?? laborResult.error?.message ?? "");
    setIsLoading(false);
  }, [department, loadRestaurantId, periodEnd, periodStart, restaurantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const departmentRevenue = useMemo(() => {
    if (department === "kitchen") {
      return sum(
        sales
          .filter((sale) => sale.category === "food")
          .map((sale) => sale.revenue),
      );
    }

    if (department === "bar") {
      return sum(
        sales
          .filter((sale) => sale.category === "beverage")
          .map((sale) => sale.revenue),
      );
    }

    return sum(sales.map((sale) => sale.revenue));
  }, [department, sales]);

  const summary = useMemo(() => {
    const totalLaborCost = sum(entries.map((entry) => entry.total_labor_cost));
    const totalHours = sum(entries.map((entry) => entry.worked_hours));
    const overtimeCost = entries.reduce(
      (total, entry) =>
        total +
        (Number(entry.overtime_hours) || 0) *
          (Number(entry.overtime_rate) || 0),
      0,
    );

    return {
      laborPercent: departmentRevenue
        ? (totalLaborCost / departmentRevenue) * 100
        : 0,
      overtimeCost,
      totalHours,
      totalLaborCost,
    };
  }, [departmentRevenue, entries]);

  async function handleSaveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!restaurantId) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const employeeId = String(formData.get("employee_id") ?? "");
    const supabase = getSupabaseBrowserClient();
    const payload = {
      bonus: Number(formData.get("bonus")) || 0,
      deductions: Number(formData.get("deductions")) || 0,
      department,
      employee_id: employeeId || null,
      fixed_salary: Number(formData.get("fixed_salary")) || 0,
      hourly_rate: Number(formData.get("hourly_rate")) || 0,
      notes: String(formData.get("notes") ?? "").trim(),
      overtime_hours: Number(formData.get("overtime_hours")) || 0,
      overtime_rate: Number(formData.get("overtime_rate")) || 0,
      period_end: periodEnd,
      period_start: periodStart,
      restaurant_id: restaurantId,
      worked_hours: Number(formData.get("worked_hours")) || 0,
    };

    setIsSaving(true);

    const { error: saveError } = editingEntry
      ? await supabase
          .from("labor_cost_entries")
          .update(payload)
          .eq("id", editingEntry.id)
          .eq("restaurant_id", restaurantId)
      : await supabase.from("labor_cost_entries").insert(payload);

    if (saveError) {
      console.error("Could not save labor cost entry:", saveError.message);
      setError(saveError.message);
      setIsSaving(false);
      return;
    }

    form.reset();
    setEditingEntry(null);
    setIsSaving(false);
    await loadData();
  }

  async function handleDeleteEntry(entry: LaborCostEntry) {
    if (!restaurantId) return;

    const confirmed = window.confirm("Delete this labor cost entry?");
    if (!confirmed) return;

    const supabase = getSupabaseBrowserClient();
    const { error: deleteError } = await supabase
      .from("labor_cost_entries")
      .delete()
      .eq("id", entry.id)
      .eq("restaurant_id", restaurantId);

    if (deleteError) {
      console.error("Could not delete labor cost entry:", deleteError.message);
      setError(deleteError.message);
      return;
    }

    await loadData();
  }

  function startEditingEntry(entry: LaborCostEntry) {
    setEditingEntry(entry);
    setDepartment(entry.department);
    setPeriodStart(entry.period_start);
    setPeriodEnd(entry.period_end);
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-page-header">
        <div>
          <h1>Labor Cost</h1>
          <p>Track payroll and labor cost by department.</p>
        </div>
      </div>

      {error ? (
        <div className="error-state">
          <strong>Could not load labor cost data.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <section className="dashboard-control-bar">
        <label>
          Department
          <select
            onChange={(event) => setDepartment(event.target.value as Department)}
            value={department}
          >
            {departments.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="dashboard-custom-range">
          <label>
            From
            <input
              onChange={(event) => setPeriodStart(event.target.value)}
              type="date"
              value={periodStart}
            />
          </label>
          <label>
            To
            <input
              onChange={(event) => setPeriodEnd(event.target.value)}
              type="date"
              value={periodEnd}
            />
          </label>
        </div>
      </section>

      <div className="dashboard-grid kpi-grid">
        <DashboardKpiCard
          title="Total labor cost"
          trend="Selected period"
          value={formatMoney(summary.totalLaborCost, currency)}
        />
        <DashboardKpiCard
          title="Total hours"
          trend="Regular worked hours"
          value={summary.totalHours.toFixed(2)}
        />
        <DashboardKpiCard
          title="Overtime cost"
          trend="Overtime hours × overtime rate"
          value={formatMoney(summary.overtimeCost, currency)}
        />
        <DashboardKpiCard
          title="Labor % of revenue"
          trend="Needs department revenue"
          value={`${summary.laborPercent.toFixed(1)}%`}
        />
      </div>

      <form
        className="form-card inventory-form"
        key={editingEntry?.id ?? "new-labor-entry"}
        onSubmit={handleSaveEntry}
      >
        <h2>{editingEntry ? "Edit labor cost entry" : "Add labor cost entry"}</h2>
        <label>
          Employee
          <select defaultValue={editingEntry?.employee_id ?? ""} name="employee_id">
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name ?? `Employee ${employee.id}`}
              </option>
            ))}
          </select>
        </label>
        <div className="labor-entry-grid">
          <label>
            Hourly rate
            <input
              defaultValue={editingEntry?.hourly_rate ?? ""}
              min="0"
              name="hourly_rate"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Worked hours
            <input
              defaultValue={editingEntry?.worked_hours ?? ""}
              min="0"
              name="worked_hours"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Overtime hours
            <input
              defaultValue={editingEntry?.overtime_hours ?? ""}
              min="0"
              name="overtime_hours"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Overtime rate
            <input
              defaultValue={editingEntry?.overtime_rate ?? ""}
              min="0"
              name="overtime_rate"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Fixed monthly salary
            <input
              defaultValue={editingEntry?.fixed_salary ?? ""}
              min="0"
              name="fixed_salary"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Bonus
            <input
              defaultValue={editingEntry?.bonus ?? ""}
              min="0"
              name="bonus"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Deductions
            <input
              defaultValue={editingEntry?.deductions ?? ""}
              min="0"
              name="deductions"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            Notes
            <input defaultValue={editingEntry?.notes ?? ""} name="notes" type="text" />
          </label>
        </div>
        <button className="button" disabled={isSaving} type="submit">
          {isSaving
            ? "Saving..."
            : editingEntry
              ? "Save changes"
              : "Save labor cost"}
        </button>
        {editingEntry ? (
          <button
            className="button secondary"
            onClick={() => setEditingEntry(null)}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </form>

      {isLoading ? (
        <div className="empty-state">Loading labor cost entries...</div>
      ) : null}

      {!isLoading && entries.length === 0 ? (
        <div className="empty-state">No labor cost entries for this period.</div>
      ) : null}

      {entries.length > 0 ? (
        <table className="items-table inventory-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Period</th>
              <th className="number">Hours</th>
              <th className="number">Overtime</th>
              <th className="number">Salary</th>
              <th className="number">Bonus</th>
              <th className="number">Deductions</th>
              <th className="number">Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{getEmployeeName(entry, employees)}</td>
                <td>
                  {entry.period_start} - {entry.period_end}
                </td>
                <td className="number">{entry.worked_hours ?? 0}</td>
                <td className="number">{entry.overtime_hours ?? 0}</td>
                <td className="number">
                  {formatMoney(entry.fixed_salary ?? 0, currency)}
                </td>
                <td className="number">
                  {formatMoney(entry.bonus ?? 0, currency)}
                </td>
                <td className="number">
                  {formatMoney(entry.deductions ?? 0, currency)}
                </td>
                <td className="number">
                  <strong>
                    {formatMoney(entry.total_labor_cost ?? 0, currency)}
                  </strong>
                </td>
                <td>
                  <button
                    className="button secondary"
                    onClick={() => startEditingEntry(entry)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => handleDeleteEntry(entry)}
                    type="button"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
