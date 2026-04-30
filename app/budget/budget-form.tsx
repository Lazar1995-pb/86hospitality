"use client";

import { useState } from "react";
import { createBudget } from "./actions";

type CostCategory = {
  id: number;
  name: string | null;
};

type BudgetLineRow = {
  id: number;
};

type BudgetFormProps = {
  costCategories: CostCategory[];
};

export function BudgetForm({ costCategories }: BudgetFormProps) {
  const [lines, setLines] = useState<BudgetLineRow[]>([{ id: 1 }]);

  return (
    <form action={createBudget} className="form-card recipe-form">
      <label>
        Name
        <input name="name" required type="text" />
      </label>

      <label>
        Period start
        <input name="period_start" required type="date" />
      </label>

      <label>
        Period end
        <input name="period_end" required type="date" />
      </label>

      <div className="form-section">
        <div className="form-section-header">
          <h2>Budget lines</h2>
          <button
            className="button secondary"
            onClick={() =>
              setLines((currentLines) => [
                ...currentLines,
                { id: Date.now() },
              ])
            }
            type="button"
          >
            Add line
          </button>
        </div>

        <div className="item-list">
          {lines.map((line) => (
            <div className="budget-line-row" key={line.id}>
              <label>
                KPI category
                <select
                  disabled={costCategories.length === 0}
                  name="cost_category_id"
                  required
                >
                  <option value="">Select category</option>
                  {costCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name ?? `Category ${category.id}`}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Planned amount
                <input
                  min="0"
                  name="planned_amount"
                  required
                  step="0.01"
                  type="number"
                />
              </label>

              <label>
                Notes
                <input name="notes" type="text" />
              </label>
            </div>
          ))}
        </div>
      </div>

      <button
        className="button"
        disabled={costCategories.length === 0}
        type="submit"
      >
        Save budget
      </button>
    </form>
  );
}
