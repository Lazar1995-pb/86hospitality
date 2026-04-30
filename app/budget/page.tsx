import { getSupabaseClient } from "@/lib/supabase";
import { BudgetForm } from "./budget-form";

type CostCategory = {
  id: number;
  name: string | null;
};

type BudgetLine = {
  id: number;
  planned_amount: number | null;
  notes: string | null;
  cost_categories:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
};

type Budget = {
  id: number;
  name: string | null;
  period_start: string | null;
  period_end: string | null;
  budget_lines: BudgetLine[];
};

async function getCostCategories() {
  const supabase = getSupabaseClient();

  return supabase
    .from("cost_categories")
    .select("id, name")
    .eq("restaurant_id", 1)
    .order("name", { ascending: true });
}

async function getBudgets() {
  const supabase = getSupabaseClient();

  return supabase
    .from("budgets")
    .select(
      `
        id,
        name,
        period_start,
        period_end,
        budget_lines (
          id,
          planned_amount,
          notes,
          cost_categories (
            name
          )
        )
      `,
    )
    .eq("restaurant_id", 1)
    .order("period_start", { ascending: false });
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

function getCategoryName(
  category: BudgetLine["cost_categories"],
): string | null {
  if (Array.isArray(category)) {
    return category[0]?.name ?? null;
  }

  return category?.name ?? null;
}

export const dynamic = "force-dynamic";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const {
    data: costCategoryData,
    error: costCategoryError,
  } = await getCostCategories().catch((caughtError: Error) => ({
    data: null,
    error: caughtError,
  }));
  const { data: budgetData, error: budgetError } = await getBudgets().catch(
    (caughtError: Error) => ({
      data: null,
      error: caughtError,
    }),
  );
  const costCategories = (costCategoryData ?? []) as CostCategory[];
  const budgets = (budgetData ?? []) as Budget[];

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Budget</h1>
          <p>Monthly budget planning by KPI category.</p>
        </div>
      </div>

      {costCategoryError ? (
        <div className="error-state">
          <strong>Could not load KPI categories.</strong>
          <p>{costCategoryError.message}</p>
        </div>
      ) : null}

      {budgetError ? (
        <div className="error-state">
          <strong>Could not load budgets.</strong>
          <p>{budgetError.message}</p>
        </div>
      ) : null}

      {params?.error ? (
        <div className="error-state">
          <strong>Could not save budget.</strong>
          <p>{params.error}</p>
        </div>
      ) : null}

      <BudgetForm costCategories={costCategories} />

      {budgets.length === 0 && !budgetError ? (
        <div className="empty-state">No budgets yet.</div>
      ) : null}

      <div className="invoice-list">
        {budgets.map((budget) => {
          const totalPlannedAmount = (budget.budget_lines ?? []).reduce(
            (sum, line) => sum + (line.planned_amount ?? 0),
            0,
          );

          return (
            <section className="invoice-card" key={budget.id}>
              <div className="invoice-summary">
                <div>
                  <span className="label">Budget</span>
                  <span className="value">{budget.name ?? "-"}</span>
                </div>
                <div>
                  <span className="label">Period</span>
                  <span className="value">
                    {formatDate(budget.period_start)} -{" "}
                    {formatDate(budget.period_end)}
                  </span>
                </div>
                <div>
                  <span className="label">Total planned amount</span>
                  <span className="value">
                    {formatAmount(totalPlannedAmount)}
                  </span>
                </div>
              </div>

              {(budget.budget_lines ?? []).length > 0 ? (
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="number">Planned amount</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(budget.budget_lines ?? []).map((line) => (
                      <tr key={line.id}>
                        <td>{getCategoryName(line.cost_categories) ?? "-"}</td>
                        <td className="number">
                          {formatAmount(line.planned_amount)}
                        </td>
                        <td>{line.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">No budget lines for this budget.</p>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
