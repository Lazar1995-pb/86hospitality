"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { getCurrentUserRestaurantId } from "@/lib/current-restaurant";
import { redirect } from "next/navigation";

export async function createMenuItem(formData: FormData) {
  const supabase = getSupabaseClient();
  const restaurantId = await getCurrentUserRestaurantId();
  const { error } = await supabase.from("menu_items").insert({
    restaurant_id: restaurantId,
    name: String(formData.get("name") ?? "").trim(),
    selling_price: Number(formData.get("selling_price")),
    active: formData.get("active") === "on",
  });

  if (error) {
    redirect(`/menu?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/menu");
}

export async function createMenuItemComponent(formData: FormData) {
  const supabase = getSupabaseClient();
  const restaurantId = await getCurrentUserRestaurantId();
  const menuItemId = Number(formData.get("menu_item_id"));
  const submittedComponentType = String(formData.get("component_type") ?? "");
  const componentType =
    submittedComponentType === "semi-product" ? "semi-product" : "inventory";
  const componentId = Number(formData.get("component_id"));
  const quantity = Number(formData.get("quantity"));
  const unit = String(formData.get("unit") ?? "").trim();
  const inventoryItemId = componentType === "inventory" ? componentId : null;
  const recipeId = componentType === "semi-product" ? componentId : null;

  console.log({
    component_type: componentType,
    inventory_item_id: inventoryItemId,
    recipe_id: recipeId,
  });

  const { error } = await supabase.from("menu_item_components").insert({
    restaurant_id: restaurantId,
    menu_item_id: menuItemId,
    component_type: componentType,
    inventory_item_id: inventoryItemId,
    recipe_id: recipeId,
    quantity,
    unit,
  });

  if (error) {
    redirect(`/menu?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/menu");
}
