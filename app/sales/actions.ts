"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { getCurrentUserRestaurantId } from "@/lib/current-restaurant";
import { redirect } from "next/navigation";

export async function createSale(formData: FormData) {
  const supabase = getSupabaseClient();
  const restaurantId = await getCurrentUserRestaurantId();
  const menuItemValue = String(formData.get("menu_item_id") ?? "");
  const menuItemId = menuItemValue ? Number(menuItemValue) : null;
  const quantityValue = String(formData.get("quantity") ?? "");
  const quantity = quantityValue ? Number(quantityValue) : null;
  const saleDate = String(formData.get("sale_date") ?? "");
  const categoryValue = String(formData.get("category") ?? "");
  const category =
    categoryValue === "food" || categoryValue === "beverage"
      ? categoryValue
      : "";
  const note = String(formData.get("note") ?? "").trim();
  const revenue = Number(formData.get("revenue"));

  if (!category) {
    redirect(`/sales?error=${encodeURIComponent("Category is required.")}`);
  }

  const { error } = await supabase.from("sales").insert({
    restaurant_id: restaurantId,
    category,
    menu_item_id: menuItemId,
    quantity: menuItemId ? quantity : null,
    revenue,
    sale_date: saleDate,
    note,
  });

  if (error) {
    redirect(`/sales?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/sales");
}
