"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

export async function createSupplier(formData: FormData) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("suppliers").insert({
    restaurant_id: 1,
    name: String(formData.get("name") ?? "").trim(),
    company_name: String(formData.get("company_name") ?? "").trim(),
    pib: String(formData.get("pib") ?? "").trim(),
    account_number: String(formData.get("account_number") ?? "").trim(),
    contact_name: String(formData.get("contact_name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
  });

  if (error) {
    redirect(`/suppliers?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/suppliers");
}
