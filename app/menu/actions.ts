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
  const componentType = String(formData.get("component_type") ?? "");
  const componentId = Number(formData.get("component_id"));
  const quantity = Number(formData.get("quantity"));
  const unit = String(formData.get("unit") ?? "").trim();

  const { error } = await supabase.from("menu_item_components").insert({
    restaurant_id: restaurantId,
    menu_item_id: menuItemId,
    inventory_item_id: componentType === "inventory" ? componentId : null,
    recipe_id: componentType === "recipe" ? componentId : null,
    quantity,
    unit,
  });

  if (error) {
    redirect(`/menu?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/menu");
}
