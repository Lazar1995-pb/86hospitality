"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

type Department = "bar" | "kitchen" | "front";

type ScheduleSelection = {
  employee_id: number;
  shift_date: string;
  shift_type_id: number;
};

type UserProfile = {
  restaurant_id: number | null;
};

function getDepartment(value: FormDataEntryValue | null): Department {
  const department = String(value ?? "");

  if (department === "bar" || department === "kitchen" || department === "front") {
    return department;
  }

  return "kitchen";
}

function getRedirectPath(department: Department, weekStart: string, error?: string) {
  const params = new URLSearchParams({
    department,
    week_start: weekStart,
  });

  if (error) {
    params.set("error", error);
  }

  return `/schedule?${params.toString()}`;
}

export async function saveSchedule(formData: FormData) {
  const department = getDepartment(formData.get("department"));
  const weekStart = String(formData.get("week_start") ?? "");
  const selectionsJson = String(formData.get("selections") ?? "[]");
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
    redirect(getRedirectPath(department, weekStart, "No restaurant profile found."));
  }

  let selections: ScheduleSelection[] = [];

  try {
    selections = JSON.parse(selectionsJson) as ScheduleSelection[];
  } catch {
    redirect(
      getRedirectPath(department, weekStart, "Could not read schedule selections."),
    );
  }

  const { data: existingSchedule, error: existingScheduleError } = await supabase
    .from("weekly_schedules")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("department", department)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existingScheduleError) {
    redirect(getRedirectPath(department, weekStart, existingScheduleError.message));
  }

  let scheduleId = existingSchedule?.id as number | undefined;

  if (!scheduleId) {
    const { data: newSchedule, error: newScheduleError } = await supabase
      .from("weekly_schedules")
      .insert({
        restaurant_id: restaurantId,
        department,
        week_start: weekStart,
      })
      .select("id")
      .single();

    if (newScheduleError) {
      redirect(getRedirectPath(department, weekStart, newScheduleError.message));
    }

    scheduleId = newSchedule.id;
  }

  const { error: deleteError } = await supabase
    .from("schedule_entries")
    .delete()
    .eq("weekly_schedule_id", scheduleId);

  if (deleteError) {
    redirect(getRedirectPath(department, weekStart, deleteError.message));
  }

  const rows = selections
    .filter(
      (selection) =>
        selection.employee_id && selection.shift_date && selection.shift_type_id,
    )
    .map((selection) => ({
      restaurant_id: restaurantId,
      weekly_schedule_id: scheduleId,
      employee_id: selection.employee_id,
      shift_type_id: selection.shift_type_id,
      shift_date: selection.shift_date,
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("schedule_entries")
      .insert(rows);

    if (insertError) {
      redirect(getRedirectPath(department, weekStart, insertError.message));
    }
  }

  redirect(getRedirectPath(department, weekStart));
}
