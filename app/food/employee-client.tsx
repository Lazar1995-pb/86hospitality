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
  restaurant_id: string | null;
  updated_at: string | null;
};

type EmployeeDocument = {
  id: number | string;
  employee_id: number | string | null;
  document_type: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string | null;
  reminder_days_before: number | null;
  notes: string | null;
};

type UserProfile = {
  restaurant_id: string | null;
};

type EmployeeClientProps = {
  department: Department;
  saveError?: string;
  title: string;
};

const departmentOptions: Department[] = ["kitchen", "bar", "front"];
const documentTypeOptions = [
  "contract",
  "work permit",
  "residence permit",
  "medical certificate",
  "training certificate",
  "ID/passport",
  "other",
];

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getRedirectPath(department: Department) {
  return `/employees?department=${department}`;
}

function getDocumentWarning(document: EmployeeDocument) {
  if (!document.expiry_date) {
    return { className: "document-status valid", label: document.status || "valid" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiryDate = new Date(document.expiry_date);
  expiryDate.setHours(0, 0, 0, 0);

  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const reminderDays = document.reminder_days_before ?? 0;

  if (daysUntilExpiry < 0 || document.status === "expired") {
    return { className: "document-status expired", label: "expired" };
  }

  if (daysUntilExpiry <= reminderDays) {
    return { className: "document-status warning", label: "expiring soon" };
  }

  return { className: "document-status valid", label: document.status || "valid" };
}

export function EmployeeClient({
  department,
  saveError,
  title,
}: EmployeeClientProps) {
  const router = useRouter();
  const [editingDocument, setEditingDocument] =
    useState<EmployeeDocument | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeDocuments, setEmployeeDocuments] = useState<
    Record<string, EmployeeDocument[]>
  >({});
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
      console.error("Could not load authenticated user:", userError.message);
      setErrors([userError.message]);
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
      console.error(
        "Could not load user profile:",
        profileError?.message ?? "No restaurant profile found.",
      );
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
        console.error("Could not load employees:", error.message);
        setErrors([error.message]);
      } else {
        const nextEmployees = (data ?? []) as Employee[];
        setEmployees(nextEmployees);

        if (nextEmployees.length === 0) {
          setEmployeeDocuments({});
          setErrors([]);
          setIsLoading(false);
          return;
        }

        const employeeIds = nextEmployees.map((employee) => employee.id);
        const { data: documents, error: documentsError } = await supabase
          .from("employee_documents")
          .select(
            "id, employee_id, document_type, issue_date, expiry_date, status, reminder_days_before, notes",
          )
          .eq("restaurant_id", restaurantId)
          .in("employee_id", employeeIds)
          .order("expiry_date", { ascending: true });

        if (documentsError) {
          console.error(
            "Could not load employee documents:",
            documentsError.message,
          );
          setErrors([documentsError.message]);
        } else {
          const documentsByEmployee = ((documents ?? []) as EmployeeDocument[]).reduce<
            Record<string, EmployeeDocument[]>
          >((groupedDocuments, document) => {
            if (!document.employee_id) return groupedDocuments;

            const employeeId = String(document.employee_id);
            groupedDocuments[employeeId] = groupedDocuments[employeeId] ?? [];
            groupedDocuments[employeeId].push(document);
            return groupedDocuments;
          }, {});

          setEmployeeDocuments(documentsByEmployee);
          setErrors([]);
        }
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
      console.error("Could not create employee:", error.message);
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
      console.error("Could not update employee:", error.message);
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
      console.error("Could not deactivate employee:", error.message);
      setErrors([error.message]);
      return;
    }

    if (editingEmployee?.id === employee.id) {
      setEditingEmployee(null);
    }

    if (editingDocument?.employee_id === employee.id) {
      setEditingDocument(null);
    }

    await loadEmployees();
  }

  async function handleCreateDocument(
    event: FormEvent<HTMLFormElement>,
    employee: Employee,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error } = await supabase.from("employee_documents").insert({
      document_type: String(formData.get("document_type") ?? "").trim(),
      employee_id: employee.id,
      expiry_date: String(formData.get("expiry_date") ?? "") || null,
      issue_date: String(formData.get("issue_date") ?? "") || null,
      notes: String(formData.get("notes") ?? "").trim(),
      reminder_days_before: Number(formData.get("reminder_days_before")) || 0,
      restaurant_id: restaurantId,
      status: String(formData.get("status") ?? "valid").trim(),
    });

    if (error) {
      console.error("Could not create employee document:", error.message);
      setErrors([error.message]);
      return;
    }

    form.reset();
    await loadEmployees();
  }

  async function handleUpdateDocument(
    event: FormEvent<HTMLFormElement>,
    employee: Employee,
  ) {
    event.preventDefault();

    if (!editingDocument) return;

    const formData = new FormData(event.currentTarget);
    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error } = await supabase
      .from("employee_documents")
      .update({
        document_type: String(formData.get("document_type") ?? "").trim(),
        expiry_date: String(formData.get("expiry_date") ?? "") || null,
        issue_date: String(formData.get("issue_date") ?? "") || null,
        notes: String(formData.get("notes") ?? "").trim(),
        reminder_days_before: Number(formData.get("reminder_days_before")) || 0,
        status: String(formData.get("status") ?? "valid").trim(),
      })
      .eq("id", editingDocument.id)
      .eq("employee_id", employee.id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      console.error("Could not update employee document:", error.message);
      setErrors([error.message]);
      return;
    }

    setEditingDocument(null);
    await loadEmployees();
  }

  async function handleDeleteDocument(
    document: EmployeeDocument,
    employee: Employee,
  ) {
    const confirmed = window.confirm(
      `Delete document "${document.document_type ?? `Document ${document.id}`}"?`,
    );

    if (!confirmed) return;

    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error } = await supabase
      .from("employee_documents")
      .delete()
      .eq("id", document.id)
      .eq("employee_id", employee.id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      console.error("Could not delete employee document:", error.message);
      setErrors([error.message]);
      return;
    }

    if (editingDocument?.id === document.id) {
      setEditingDocument(null);
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

      <form className="form-card kpi-filters">
        <label>
          Department
          <select defaultValue={department} name="department">
            {departmentOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button className="button" type="submit">
          Load employees
        </button>
      </form>

      {!isLoading && !editingEmployee ? (
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
        <form
          className="form-card inventory-form"
          key={editingEmployee.id}
          onSubmit={handleUpdateEmployee}
        >
          <h2>Edit employee</h2>
          <p className="muted">
            Updating {editingEmployee.full_name ?? `Employee ${editingEmployee.id}`}.
          </p>

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
        {employees.map((employee) => {
          const documents = employeeDocuments[String(employee.id)] ?? [];

          return (
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

              <div className="form-section">
                <h2>Documents</h2>

                {documents.length > 0 ? (
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Document type</th>
                        <th>Issue date</th>
                        <th>Expiry date</th>
                        <th>Status</th>
                        <th className="number">Reminder</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => {
                        const warning = getDocumentWarning(document);

                        return (
                          <tr key={document.id}>
                            <td>{document.document_type ?? "-"}</td>
                            <td>{formatDate(document.issue_date)}</td>
                            <td>{formatDate(document.expiry_date)}</td>
                            <td>
                              <span className={warning.className}>
                                {warning.label}
                              </span>
                            </td>
                            <td className="number">
                              {document.reminder_days_before ?? 0} days
                            </td>
                            <td>{document.notes ?? "-"}</td>
                            <td>
                              <button
                                className="button secondary"
                                onClick={() => setEditingDocument(document)}
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                className="button secondary"
                                onClick={() =>
                                  handleDeleteDocument(document, employee)
                                }
                                type="button"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">No documents yet.</p>
                )}

                <form
                  className="employee-document-form"
                  key={
                    editingDocument?.employee_id === employee.id
                      ? `edit-${editingDocument.id}`
                      : `add-${employee.id}`
                  }
                  onSubmit={(event) =>
                    editingDocument?.employee_id === employee.id
                      ? handleUpdateDocument(event, employee)
                      : handleCreateDocument(event, employee)
                  }
                >
                  <label>
                    Document type
                    <select
                      defaultValue={
                        editingDocument?.employee_id === employee.id
                          ? editingDocument.document_type ?? "contract"
                          : "contract"
                      }
                      name="document_type"
                      required
                    >
                      {documentTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Issue date
                    <input
                      defaultValue={
                        editingDocument?.employee_id === employee.id
                          ? editingDocument.issue_date ?? ""
                          : ""
                      }
                      name="issue_date"
                      type="date"
                    />
                  </label>

                  <label>
                    Expiry date
                    <input
                      defaultValue={
                        editingDocument?.employee_id === employee.id
                          ? editingDocument.expiry_date ?? ""
                          : ""
                      }
                      name="expiry_date"
                      type="date"
                    />
                  </label>

                  <label>
                    Status
                    <select
                      defaultValue={
                        editingDocument?.employee_id === employee.id
                          ? editingDocument.status ?? "valid"
                          : "valid"
                      }
                      name="status"
                    >
                      <option value="valid">valid</option>
                      <option value="pending">pending</option>
                      <option value="expired">expired</option>
                    </select>
                  </label>

                  <label>
                    Reminder days before
                    <input
                      defaultValue={
                        editingDocument?.employee_id === employee.id
                          ? editingDocument.reminder_days_before ?? 30
                          : 30
                      }
                      min="0"
                      name="reminder_days_before"
                      type="number"
                    />
                  </label>

                  <label>
                    Notes
                    <input
                      defaultValue={
                        editingDocument?.employee_id === employee.id
                          ? editingDocument.notes ?? ""
                          : ""
                      }
                      name="notes"
                      type="text"
                    />
                  </label>

                  <button className="button secondary" type="submit">
                    {editingDocument?.employee_id === employee.id
                      ? "Save document changes"
                      : "Add document"}
                  </button>
                  {editingDocument?.employee_id === employee.id ? (
                    <button
                      className="button secondary"
                      onClick={() => setEditingDocument(null)}
                      type="button"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </form>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
