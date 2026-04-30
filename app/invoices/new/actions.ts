"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

type UserProfile = {
  restaurant_id: number | null;
};

export async function createInvoice(formData: FormData) {
  const supplierId = Number(formData.get("supplier_id"));
  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim();
  const invoiceDate = String(formData.get("invoice_date") ?? "");
  const total = Number(formData.get("total"));
  const costCategoryId = Number(formData.get("cost_category_id"));
  const costSubcategoryValue = String(formData.get("cost_subcategory_id") ?? "");
  const errors: string[] = [];

  if (!supplierId) errors.push("Supplier is required.");
  if (!invoiceNumber) errors.push("Invoice number is required.");
  if (!invoiceDate) errors.push("Invoice date is required.");
  if (!total) errors.push("Total is required.");
  if (!costCategoryId) errors.push("KPI category is required.");

  if (errors.length > 0) {
    redirect(`/invoices/new?error=${encodeURIComponent(errors.join(" "))}`);
  }

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("restaurant_id")
    .eq("auth_user_id", userData.user.id)
    .single();

  const restaurantId = (profile as UserProfile | null)?.restaurant_id;

  if (profileError || !restaurantId) {
    console.error("Could not load user profile:", profileError);
    redirect(
      `/invoices/new?error=${encodeURIComponent("No restaurant profile found")}`,
    );
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      total,
    })
    .select("id")
    .single();

  if (invoiceError) {
    redirect(`/invoices/new?error=${encodeURIComponent(invoiceError.message)}`);
  }

  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    restaurant_id: restaurantId,
    cost_category_id: costCategoryId,
    cost_subcategory_id: costSubcategoryValue
      ? Number(costSubcategoryValue)
      : null,
    item_name: "Invoice total",
    quantity: 1,
    unit_price: total,
    total_price: total,
  });

  if (itemError) {
    redirect(`/invoices/new?error=${encodeURIComponent(itemError.message)}`);
  }

  redirect("/invoices");
}
