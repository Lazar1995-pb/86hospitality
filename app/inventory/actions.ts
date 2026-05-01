"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { getCurrentUserRestaurantId } from "@/lib/current-restaurant";
import { redirect } from "next/navigation";

export async function createInventoryItem(formData: FormData) {
  const supabase = getSupabaseClient();
  const restaurantId = await getCurrentUserRestaurantId();
  const name = String(formData.get("name") ?? "").trim();
  const { data: existingItem, error: duplicateCheckError } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .ilike("name", name)
    .maybeSingle();

  if (duplicateCheckError) {
    redirect(`/inventory?error=${encodeURIComponent(duplicateCheckError.message)}`);
  }

  if (existingItem) {
    redirect(
      `/inventory?error=${encodeURIComponent("Inventory item name already exists.")}`,
    );
  }

  const { error } = await supabase.from("inventory_items").insert({
    restaurant_id: restaurantId,
    name,
    unit: String(formData.get("unit") ?? "").trim(),
    base_unit: String(formData.get("base_unit") ?? "").trim(),
    base_unit_cost: Number(formData.get("base_unit_cost")),
    cost_subcategory_id: Number(formData.get("cost_subcategory_id")),
    minimum_stock: Number(formData.get("minimum_stock")),
    active: formData.get("active") === "on",
  });

  if (error) {
    redirect(`/inventory?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/inventory");
}
