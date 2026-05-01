"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { getCurrentUserRestaurantId } from "@/lib/current-restaurant";
import { redirect } from "next/navigation";

function getRedirectPath(formData: FormData, messageKey: string, message: string) {
  const params = new URLSearchParams();
  const fromDate = String(formData.get("from_date") ?? "");
  const toDate = String(formData.get("to_date") ?? "");
  const grouping = String(formData.get("grouping") ?? "");

  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  if (grouping) params.set("grouping", grouping);

  params.set(messageKey, message);

  return `/kpi?${params.toString()}`;
}

export async function createKpiCategory(formData: FormData) {
  const name = String(formData.get("category_name") ?? "").trim();

  if (!name) {
    redirect(
      getRedirectPath(formData, "category_error", "KPI category name is required."),
    );
  }

  const supabase = getSupabaseClient();
  const restaurantId = await getCurrentUserRestaurantId().catch(
    (caughtError: Error) => {
      console.error(caughtError);
      return null;
    },
  );

  if (!restaurantId) {
    redirect(
      getRedirectPath(formData, "category_error", "No restaurant profile found."),
    );
  }

  const { error: insertError } = await supabase.from("cost_categories").insert({
    name,
    restaurant_id: restaurantId,
  });

  if (insertError) {
    console.error("Could not create KPI category:", insertError);
    redirect(getRedirectPath(formData, "category_error", insertError.message));
  }

  redirect(getRedirectPath(formData, "category_message", "KPI category added."));
}
