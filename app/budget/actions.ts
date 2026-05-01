"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { getCurrentUserRestaurantId } from "@/lib/current-restaurant";
import { redirect } from "next/navigation";

export async function createBudget(formData: FormData) {
  const supabase = getSupabaseClient();
  const restaurantId = await getCurrentUserRestaurantId();
  const name = String(formData.get("name") ?? "").trim();
  const periodStart = String(formData.get("period_start") ?? "");
  const periodEnd = String(formData.get("period_end") ?? "");
  const costCategoryIds = formData.getAll("cost_category_id").map(Number);
  const plannedAmounts = formData.getAll("planned_amount").map(Number);
  const notes = formData.getAll("notes").map(String);

  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .insert({
      restaurant_id: restaurantId,
      name,
      period_start: periodStart,
      period_end: periodEnd,
    })
    .select("id")
    .single();

  if (budgetError) {
    redirect(`/budget?error=${encodeURIComponent(budgetError.message)}`);
  }

  const lines = costCategoryIds
    .map((costCategoryId, index) => ({
      budget_id: budget.id,
      cost_category_id: costCategoryId,
      planned_amount: plannedAmounts[index] || 0,
      notes: notes[index] || "",
    }))
    .filter((line) => line.cost_category_id);

  if (lines.length > 0) {
    const { error: linesError } = await supabase
      .from("budget_lines")
      .insert(lines);

    if (linesError) {
      redirect(`/budget?error=${encodeURIComponent(linesError.message)}`);
    }
  }

  redirect("/budget");
}
