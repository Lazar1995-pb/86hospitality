"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

export async function createRecipe(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const active = formData.get("active") === "on";
  const totalCost = Number(formData.get("total_cost"));
  const yieldQuantity = Number(formData.get("yield_quantity"));
  const yieldUnit = String(formData.get("yield_unit") ?? "").trim();
  const costPerUnit = Number(formData.get("cost_per_unit"));
  const inventoryItemIds = formData
    .getAll("inventory_item_id")
    .map((inventoryItemId) => String(inventoryItemId));
  const quantities = formData.getAll("quantity").map(Number);
  const units = formData.getAll("unit").map(String);

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users_profiles")
    .select("restaurant_id")
    .eq("auth_user_id", userData.user.id)
    .single();

  if (profileError || !profile?.restaurant_id) {
    redirect(
      `/recipes?error=${encodeURIComponent("No restaurant profile found")}`,
    );
  }

  const recipePayload = {
    name,
    active,
    total_cost: totalCost,
    yield_quantity: yieldQuantity,
    yield_unit: yieldUnit,
    cost_per_unit: costPerUnit,
    restaurant_id: profile.restaurant_id,
  };

  console.log("recipe insert payload", recipePayload);

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert(recipePayload)
    .select("id")
    .single();

  if (recipeError) {
    redirect(`/recipes?error=${encodeURIComponent(recipeError.message)}`);
  }

  const recipeItems = inventoryItemIds
    .map((inventoryItemId, index) => ({
      recipe_id: recipe.id,
      inventory_item_id: inventoryItemId,
      quantity: quantities[index] || 0,
      unit: units[index] || "",
      waste_percent: 0,
      restaurant_id: profile.restaurant_id,
    }))
    .filter((item) => item.inventory_item_id);

  if (recipeItems.length > 0) {
    const { error: itemsError } = await supabase
      .from("recipe_items")
      .insert(recipeItems);

    if (itemsError) {
      redirect(`/recipes?error=${encodeURIComponent(itemsError.message)}`);
    }
  }

  redirect("/recipes");
}
