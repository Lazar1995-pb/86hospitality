"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { saveSchedule } from "./actions";

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

type ScheduleEntry = {
  id: number;
  employee_id: number | null;
  shift_date: string | null;
  shift_type_id: number | null;
  weekly_schedule_id: number | null;
};

type Department = "bar" | "kitchen" | "front";

type ScheduleGridProps = {
  department: Department;
  employees: Employee[];
  entries: ScheduleEntry[];
  error?: string;
  shiftTypes: ShiftType[];
  weekStart: string;
};

type UserProfile = {
  restaurant_id: string | null;
};

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCellKey(employeeId: number, date: string) {
  return `${employeeId}:${date}`;
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function ScheduleGrid({
  department,
  employees,
  entries,
  error,
  shiftTypes,
  weekStart,
}: ScheduleGridProps) {
  const router = useRouter();
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [entryError, setEntryError] = useState("");
  const days = useMemo(() => {
    const firstDay = new Date(`${weekStart}T00:00:00`);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + index);

      return {
        date,
        key: getDateKey(date),
      };
    });
  }, [weekStart]);

  const initialSelections = useMemo(() => {
    return entries.reduce<Record<string, string>>((selections, entry) => {
      if (!entry.employee_id || !entry.shift_date || !entry.shift_type_id) {
        return selections;
      }

      selections[getCellKey(entry.employee_id, entry.shift_date)] = String(
        entry.shift_type_id,
      );
      return selections;
    }, {});
  }, [entries]);

  const [selections, setSelections] = useState(initialSelections);

  useEffect(() => {
    setSelections(initialSelections);
  }, [initialSelections]);

  const scheduleRows = useMemo(() => {
    return Object.entries(selections)
      .map(([cellKey, shiftTypeId]) => {
        const [employeeId, shiftDate] = cellKey.split(":");

        return {
          employee_id: Number(employeeId),
          shift_date: shiftDate,
          shift_type_id: Number(shiftTypeId),
        };
      })
      .filter((selection) => selection.shift_type_id);
  }, [selections]);

  const selectionsJson = JSON.stringify(scheduleRows);

  async function getRestaurantId() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Could not load authenticated user:", userError);
      setEntryError(userError.message);
      return null;
    }

    if (!user) {
      router.replace("/login");
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users_profiles")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !(profile as UserProfile | null)?.restaurant_id) {
      console.error("Could not load user profile:", profileError);
      setEntryError(profileError?.message ?? "No restaurant profile found.");
      return null;
    }

    return (profile as UserProfile).restaurant_id;
  }

  function getEmployeeName(employeeId: number | null) {
    const employee = employees.find((item) => item.id === employeeId);

    return employee?.full_name ?? (employeeId ? `Employee ${employeeId}` : "-");
  }

  function getShiftLabel(shiftTypeId: number | null) {
    const shiftType = shiftTypes.find((item) => item.id === shiftTypeId);

    if (!shiftType) return shiftTypeId ? `Shift ${shiftTypeId}` : "-";

    return `${shiftType.name ?? `Shift ${shiftType.id}`} (${shiftType.start_time ?? "-"} - ${shiftType.end_time ?? "-"})`;
  }

  async function handleUpdateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingEntry) return;

    const formData = new FormData(event.currentTarget);
    const employeeId = Number(formData.get("employee_id"));
    const shiftDate = String(formData.get("shift_date") ?? "");
    const shiftTypeId = Number(formData.get("shift_type_id"));

    if (!employeeId || !shiftDate || !shiftTypeId) {
      setEntryError("Employee, date, and shift are required.");
      return;
    }

    const restaurantId = await getRestaurantId();
    if (!restaurantId) return;

    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from("schedule_entries")
      .update({
        employee_id: employeeId,
        shift_date: shiftDate,
        shift_type_id: shiftTypeId,
      })
      .eq("id", editingEntry.id)
      .eq("restaurant_id", restaurantId);

    if (updateError) {
      console.error("Could not update schedule entry:", updateError);
      setEntryError(updateError.message);
      return;
    }

    setEditingEntry(null);
    setEntryError("");
    router.refresh();
  }

  async function handleDeleteEntry(entry: ScheduleEntry) {
    const confirmed = window.confirm(
      `Delete schedule entry for ${getEmployeeName(entry.employee_id)} on ${entry.shift_date ?? "this date"}?`,
    );

    if (!confirmed) return;

    const restaurantId = await getRestaurantId();
    if (!restaurantId) return;

    const supabase = getSupabaseBrowserClient();
    const { error: deleteError } = await supabase
      .from("schedule_entries")
      .delete()
      .eq("id", entry.id)
      .eq("restaurant_id", restaurantId);

    if (deleteError) {
      console.error("Could not delete schedule entry:", deleteError);
      setEntryError(deleteError.message);
      return;
    }

    if (editingEntry?.id === entry.id) {
      setEditingEntry(null);
    }

    setEntryError("");
    router.refresh();
  }

  function exportCsv() {
    const rows = [
      [
        "employee name",
        "date",
        "day",
        "shift name",
        "start_time",
        "end_time",
      ],
    ];

    scheduleRows.forEach((selection) => {
      const employee = employees.find(
        (item) => item.id === selection.employee_id,
      );
      const shiftType = shiftTypes.find(
        (item) => item.id === selection.shift_type_id,
      );
      const date = new Date(`${selection.shift_date}T00:00:00`);

      rows.push([
        employee?.full_name ?? `Employee ${selection.employee_id}`,
        selection.shift_date,
        dayFormatter.format(date),
        shiftType?.name ?? `Shift ${selection.shift_type_id}`,
        shiftType?.start_time ?? "",
        shiftType?.end_time ?? "",
      ]);
    });

    const csv = rows
      .map((row) => row.map((value) => escapeCsv(value)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${department}-schedule-${weekStart}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {error ? (
        <div className="error-state">
          <strong>Could not save schedule.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {entryError ? (
        <div className="error-state">
          <strong>Could not update schedule entry.</strong>
          <p>{entryError}</p>
        </div>
      ) : null}

      <form className="form-card kpi-filters">
        <label>
          Department
          <select defaultValue={department} name="department">
            <option value="bar">Bar</option>
            <option value="kitchen">Kitchen</option>
            <option value="front">Front</option>
          </select>
        </label>

        <label>
          Week start
          <input defaultValue={weekStart} name="week_start" required type="date" />
        </label>

        <button className="button" type="submit">
          Load schedule
        </button>
      </form>

      <form action={saveSchedule}>
        <input name="department" type="hidden" value={department} />
        <input name="week_start" type="hidden" value={weekStart} />
        <input name="selections" type="hidden" value={selectionsJson} />

        <div className="form-section-header schedule-actions">
          <h2>Weekly schedule</h2>
          <div>
            <button
              className="button secondary"
              onClick={exportCsv}
              type="button"
            >
              Export CSV
            </button>
            <button className="button" type="submit">
              Save schedule
            </button>
          </div>
        </div>

        {employees.length === 0 ? (
          <div className="empty-state">No active employees found.</div>
        ) : null}

        {shiftTypes.length === 0 ? (
          <div className="empty-state">No active shift types found.</div>
        ) : null}

        {employees.length > 0 ? (
          <div className="schedule-table-wrap">
            <table className="items-table inventory-table schedule-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  {days.map((day) => (
                    <th key={day.key}>
                      {dayFormatter.format(day.date)}
                      <br />
                      {dateFormatter.format(day.date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <strong>{employee.full_name ?? `Employee ${employee.id}`}</strong>
                      <br />
                      <span className="muted">{employee.position ?? "-"}</span>
                    </td>
                    {days.map((day) => {
                      const cellKey = getCellKey(employee.id, day.key);

                      return (
                        <td key={cellKey}>
                          <select
                            aria-label={`${employee.full_name ?? employee.id} ${day.key}`}
                            disabled={shiftTypes.length === 0}
                            onChange={(event) =>
                              setSelections((currentSelections) => ({
                                ...currentSelections,
                                [cellKey]: event.target.value,
                              }))
                            }
                            value={selections[cellKey] ?? ""}
                          >
                            <option value="">Off</option>
                            {shiftTypes.map((shiftType) => (
                              <option key={shiftType.id} value={shiftType.id}>
                                {shiftType.name ?? `Shift ${shiftType.id}`}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </form>

      <section className="dashboard-section">
        <h2>Schedule entries</h2>

        {editingEntry ? (
          <form className="form-card inventory-form" onSubmit={handleUpdateEntry}>
            <label>
              Employee
              <select
                defaultValue={editingEntry.employee_id ?? ""}
                name="employee_id"
                required
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name ?? `Employee ${employee.id}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Date
              <input
                defaultValue={editingEntry.shift_date ?? ""}
                name="shift_date"
                required
                type="date"
              />
            </label>

            <label>
              Shift / time
              <select
                defaultValue={editingEntry.shift_type_id ?? ""}
                name="shift_type_id"
                required
              >
                <option value="">Select shift</option>
                {shiftTypes.map((shiftType) => (
                  <option key={shiftType.id} value={shiftType.id}>
                    {shiftType.name ?? `Shift ${shiftType.id}`} (
                    {shiftType.start_time ?? "-"} - {shiftType.end_time ?? "-"})
                  </option>
                ))}
              </select>
            </label>

            <button className="button" type="submit">
              Save entry
            </button>
            <button
              className="button secondary"
              onClick={() => setEditingEntry(null)}
              type="button"
            >
              Cancel
            </button>
          </form>
        ) : null}

        {entries.length > 0 ? (
          <table className="items-table inventory-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Shift / time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{getEmployeeName(entry.employee_id)}</td>
                  <td>{entry.shift_date ?? "-"}</td>
                  <td>{getShiftLabel(entry.shift_type_id)}</td>
                  <td>
                    <button
                      className="button secondary"
                      onClick={() => setEditingEntry(entry)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => handleDeleteEntry(entry)}
                      type="button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">No saved schedule entries yet.</div>
        )}
      </section>
    </>
  );
}
