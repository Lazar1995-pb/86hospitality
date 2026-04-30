"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Department } from "./employee-page";

type Employee = {
  active: boolean | null;
  created_at: string | null;
  department: string | null;
  email: string | null;
  full_name: string | null;
  id: number;
  phone: string | null;
  position: string | null;
  restaurant_id: number | null;
  updated_at: string | null;
};

type UserProfile = {
  restaurant_id: number | null;
};

type EmployeeClientProps = {
  department: Department;
  saveError?: string;
  title: string;
};

const departmentOptions: Department[] = ["kitchen", "bar", "front"];

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getRedirectPath(department: Department) {
  if (department === "bar") return "/bar/bar-employees";
  if (department === "front") return "/employees?department=front";

  return "/food/kitchen-employees";
}

export function EmployeeClient({
  department,
  saveError,
  title,
}: EmployeeClientProps) {
  const router = useRouter();
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getRestaurantId = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Could not load authenticated user:", userError);
      setErrors([userError.message]);
      return null;
    }

    if (!user) {
      router.replace("/login");
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !(profile as UserProfile | null)?.restaurant_id) {
      console.error("Could not load user profile:", profileError);
      setErrors([profileError?.message ?? "No restaurant profile found."]);
      return null;
    }

    return (profile as UserProfile).restaurant_id;
  }, [router]);

  const loadEmployees = useCallback(
    async (isMounted = true) => {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();
      const restaurantId = await getRestaurantId();

      if (!restaurantId) {
        if (isMounted) setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, restaurant_id, department, full_name, position, phone, email, active, created_at, updated_at",
        )
        .eq("restaurant_id", restaurantId)
        .eq("department", department)
        .eq("active", true)
        .order("full_name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Could not load employees:", error);
        setErrors([error.message]);
      } else {
        setEmployees((data ?? []) as Employee[]);
        setErrors([]);
      }

      setIsLoading(false);
    },
    [department, getRestaurantId],
  );

  useEffect(() => {
    let isMounted = true;

    loadEmployees(isMounted);

    return () => {
      isMounted = false;
    };
  }, [loadEmployees]);

  async function handleCreateEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error } = await supabase.from("employees").insert({
      active: true,
      department,
      email: String(formData.get("email") ?? "").trim(),
      full_name: String(formData.get("full_name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      position: String(formData.get("position") ?? "").trim(),
      restaurant_id: restaurantId,
    });

    if (error) {
      console.error("Could not create employee:", error);
      setErrors([error.message]);
      return;
    }

    form.reset();
    await loadEmployees();
  }

  async function handleUpdateEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingEmployee) return;

    const formData = new FormData(event.currentTarget);
    const nextDepartment = String(
      formData.get("department") ?? department,
    ) as Department;
    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error } = await supabase
      .from("employees")
      .update({
        department: nextDepartment,
        email: String(formData.get("email") ?? "").trim(),
        full_name: String(formData.get("full_name") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim(),
        position: String(formData.get("position") ?? "").trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingEmployee.id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      console.error("Could not update employee:", error);
      setErrors([error.message]);
      return;
    }

    setEditingEmployee(null);
    await loadEmployees();

    if (nextDepartment !== department) {
      router.push(getRedirectPath(nextDepartment));
    }
  }

  async function handleDeactivateEmployee(employee: Employee) {
    const confirmed = window.confirm(
      `Delete employee "${employee.full_name ?? `Employee ${employee.id}`}"? This will deactivate them.`,
    );

    if (!confirmed) return;

    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error } = await supabase
      .from("employees")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", employee.id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      console.error("Could not deactivate employee:", error);
      setErrors([error.message]);
      return;
    }

    if (editingEmployee?.id === employee.id) {
      setEditingEmployee(null);
    }

    await loadEmployees();
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>Add, edit, and delete employees.</p>
        </div>
      </div>

      {isLoading ? <div className="empty-state">Loading employees...</div> : null}

      {errors.length > 0 ? (
        <div className="error-state">
          <strong>Could not load employee data.</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <div className="error-state">
          <strong>Could not save employee.</strong>
          <p>{saveError}</p>
        </div>
      ) : null}

      {!isLoading ? (
        <form className="form-card inventory-form" onSubmit={handleCreateEmployee}>
          <label>
            Full name
            <input name="full_name" required type="text" />
          </label>

          <label>
            Role
            <input name="position" type="text" />
          </label>

          <label>
            Phone
            <input name="phone" type="text" />
          </label>

          <label>
            Email
            <input name="email" type="email" />
          </label>

          <button className="button" type="submit">
            Add employee
          </button>
        </form>
      ) : null}

      {editingEmployee ? (
        <form className="form-card inventory-form" onSubmit={handleUpdateEmployee}>
          <h2>Edit employee</h2>

          <label>
            Full name
            <input
              defaultValue={editingEmployee.full_name ?? ""}
              name="full_name"
              required
              type="text"
            />
          </label>

          <label>
            Role
            <input
              defaultValue={editingEmployee.position ?? ""}
              name="position"
              type="text"
            />
          </label>

          <label>
            Department
            <select
              defaultValue={editingEmployee.department ?? department}
              name="department"
              required
            >
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            Phone
            <input
              defaultValue={editingEmployee.phone ?? ""}
              name="phone"
              type="text"
            />
          </label>

          <label>
            Email
            <input
              defaultValue={editingEmployee.email ?? ""}
              name="email"
              type="email"
            />
          </label>

          <button className="button" type="submit">
            Save changes
          </button>
          <button
            className="button secondary"
            onClick={() => setEditingEmployee(null)}
            type="button"
          >
            Cancel
          </button>
        </form>
      ) : null}

      {employees.length === 0 && !isLoading && errors.length === 0 ? (
        <div className="empty-state">No active employees yet.</div>
      ) : null}

      <div className="invoice-list">
        {employees.map((employee) => (
          <section className="invoice-card" key={employee.id}>
            <div className="invoice-summary">
              <div>
                <span className="label">Name</span>
                <span className="value">{employee.full_name ?? "-"}</span>
              </div>
              <div>
                <span className="label">Role</span>
                <span className="value">{employee.position ?? "-"}</span>
              </div>
              <div>
                <span className="label">Department</span>
                <span className="value">{employee.department ?? "-"}</span>
              </div>
              <div>
                <span className="label">Phone</span>
                <span className="value">{employee.phone ?? "-"}</span>
              </div>
              <div>
                <span className="label">Email</span>
                <span className="value">{employee.email ?? "-"}</span>
              </div>
              <div>
                <span className="label">Created</span>
                <span className="value">{formatDate(employee.created_at)}</span>
              </div>
              <div>
                <span className="label">Actions</span>
                <span className="value">
                  <button
                    className="button secondary"
                    onClick={() => setEditingEmployee(employee)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => handleDeactivateEmployee(employee)}
                    type="button"
                  >
                    Delete
                  </button>
                </span>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
