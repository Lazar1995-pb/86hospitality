"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { getCurrentUserRestaurantId } from "@/lib/current-restaurant";
import { redirect } from "next/navigation";

type Department = "kitchen" | "bar";

function getDepartment(formData: FormData): Department {
  const department = String(formData.get("department") ?? "");

  if (department === "kitchen" || department === "bar") {
    return department;
  }

  return "kitchen";
}

function getRedirectPath(department: Department) {
  return department === "kitchen"
    ? "/food/kitchen-employees"
    : "/bar/bar-employees";
}

export async function createEmployee(formData: FormData) {
  const department = getDepartment(formData);
  const redirectPath = getRedirectPath(department);
  const supabase = getSupabaseClient();
  const restaurantId = await getCurrentUserRestaurantId();
  const { error } = await supabase.from("employees").insert({
    restaurant_id: restaurantId,
    department,
    full_name: String(formData.get("full_name") ?? "").trim(),
    position: String(formData.get("position") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    active: formData.get("active") === "on",
  });

  if (error) {
    redirect(`${redirectPath}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(redirectPath);
}

export async function updateEmployee(formData: FormData) {
  const id = Number(formData.get("id"));
  const department = getDepartment(formData);
  const redirectPath = getRedirectPath(department);
  const supabase = getSupabaseClient();
  const restaurantId = await getCurrentUserRestaurantId();
  const { error } = await supabase
    .from("employees")
    .update({
      full_name: String(formData.get("full_name") ?? "").trim(),
      position: String(formData.get("position") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      active: formData.get("active") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .eq("department", department);

  if (error) {
    redirect(`${redirectPath}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(redirectPath);
}

export async function deleteEmployee(formData: FormData) {
  const id = Number(formData.get("id"));
  const department = getDepartment(formData);
  const redirectPath = getRedirectPath(department);
  const supabase = getSupabaseClient();
  const restaurantId = await getCurrentUserRestaurantId();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .eq("department", department);

  if (error) {
    redirect(`${redirectPath}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(redirectPath);
}
