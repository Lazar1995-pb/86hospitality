import { getSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { ScheduleGrid } from "./schedule-grid";

type Department = "bar" | "kitchen" | "front";

type Employee = {
  id: number;
  full_name: string | null;
  position: string | null;
};

type ShiftType = {
  id: number;
  name: string | null;
  start_time: string | null;
  end_time: string | null;
};

type WeeklySchedule = {
  id: number;
};

type ScheduleEntry = {
  id: number;
  employee_id: number | null;
  shift_date: string | null;
  shift_type_id: number | null;
  weekly_schedule_id: number | null;
};

const departments: Department[] = ["bar", "kitchen", "front"];

function getDepartment(value: string | undefined): Department {
  if (value && departments.includes(value as Department)) {
    return value as Department;
  }

  return "kitchen";
}

function getDefaultWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + mondayOffset);

  return date.toISOString().slice(0, 10);
}

type UserProfile = {
  restaurant_id: number | null;
};

async function getRestaurantId() {
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

  if (profileError || !(profile as UserProfile | null)?.restaurant_id) {
    return null;
  }

  return (profile as UserProfile).restaurant_id;
}

async function getEmployees(department: Department, restaurantId: number) {
  const supabase = getSupabaseClient();

  return supabase
    .from("employees")
    .select("id, full_name, position")
    .eq("restaurant_id", restaurantId)
    .eq("active", true)
    .eq("department", department)
    .order("full_name", { ascending: true });
}

async function getShiftTypes(department: Department, restaurantId: number) {
  const supabase = getSupabaseClient();

  return supabase
    .from("shift_types")
    .select("id, name, start_time, end_time")
    .eq("restaurant_id", restaurantId)
    .eq("department", department)
    .eq("active", true)
    .order("start_time", { ascending: true });
}

async function getWeeklySchedule(
  department: Department,
  weekStart: string,
  restaurantId: number,
) {
  const supabase = getSupabaseClient();

  return supabase
    .from("weekly_schedules")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("department", department)
    .eq("week_start", weekStart)
    .maybeSingle();
}

async function getScheduleEntries(scheduleId?: number) {
  if (!scheduleId) {
    return { data: [], error: null };
  }

  const supabase = getSupabaseClient();

  return supabase
    .from("schedule_entries")
    .select("id, employee_id, shift_date, shift_type_id, weekly_schedule_id")
    .eq("weekly_schedule_id", scheduleId);
}

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: Promise<{
    department?: string;
    error?: string;
    week_start?: string;
  }>;
}) {
  const params = await searchParams;
  const department = getDepartment(params?.department);
  const weekStart = params?.week_start || getDefaultWeekStart();
  const restaurantId = await getRestaurantId();
  const noRestaurantError = restaurantId
    ? null
    : new Error("No restaurant profile found.");
  const { data: employees, error: employeeError } =
    restaurantId
      ? await getEmployees(department, restaurantId)
      : { data: [], error: noRestaurantError };
  const { data: shiftTypeData, error: shiftTypeError } =
    restaurantId
      ? await getShiftTypes(department, restaurantId)
      : { data: [], error: noRestaurantError };
  const { data: scheduleData, error: scheduleError } = restaurantId
    ? await getWeeklySchedule(department, weekStart, restaurantId)
    : { data: null, error: noRestaurantError };
  const schedule = scheduleData as WeeklySchedule | null;
  const { data: entryData, error: entryError } = await getScheduleEntries(
    schedule?.id,
  );

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Schedule</h1>
          <p>Weekly staff scheduling by department.</p>
        </div>
      </div>

      {employeeError ? (
        <div className="error-state">
          <strong>Could not load employees.</strong>
          <p>{employeeError.message}</p>
        </div>
      ) : null}

      {shiftTypeError ? (
        <div className="error-state">
          <strong>Could not load shift types.</strong>
          <p>{shiftTypeError.message}</p>
        </div>
      ) : null}

      {scheduleError ? (
        <div className="error-state">
          <strong>Could not load weekly schedule.</strong>
          <p>{scheduleError.message}</p>
        </div>
      ) : null}

      {entryError ? (
        <div className="error-state">
          <strong>Could not load schedule entries.</strong>
          <p>{entryError.message}</p>
        </div>
      ) : null}

      <ScheduleGrid
        department={department}
        employees={(employees ?? []) as Employee[]}
        entries={(entryData ?? []) as ScheduleEntry[]}
        error={params?.error}
        shiftTypes={(shiftTypeData ?? []) as ShiftType[]}
        weekStart={weekStart}
      />
    </main>
  );
}
