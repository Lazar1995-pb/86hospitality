"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

type UserProfile = {
  restaurant_id: number | null;
};

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
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    console.error("Could not load authenticated user:", userError);
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
