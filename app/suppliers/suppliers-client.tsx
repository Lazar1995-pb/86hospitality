"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Supplier = {
  active: boolean | null;
  id: number;
  name: string | null;
  company_name: string | null;
  pib: string | null;
  account_number: string | null;
  contact_name: string | null;
  phone: string | null;
};

type UserProfile = {
  restaurant_id: string | null;
};

type Invoice = {
  invoice_date: string | null;
  suppliers:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
  invoice_items: {
    total_price: number | null;
  }[];
};

type SupplierCostAnalysis = {
  supplier_name: string;
  total_cost: number;
  number_of_invoice_items: number;
};

type SuppliersClientProps = {
  fromDate: string;
  saveError?: string;
  toDate: string;
};

function getRelatedItem<T>(item: T | T[] | null | undefined): T | null {
  if (Array.isArray(item)) {
    return item[0] ?? null;
  }

  return item ?? null;
}

function isInDateRange(
  value: string | null,
  fromDate: string,
  toDate: string,
) {
  if (!value) return true;

  if (fromDate && value < fromDate) return false;
  if (toDate && value > toDate) return false;

  return true;
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function SuppliersClient({
  fromDate,
  saveError,
  toDate,
}: SuppliersClientProps) {
  const router = useRouter();
  const [analysisInvoices, setAnalysisInvoices] = useState<Invoice[]>([]);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const getUserProfile = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Could not load authenticated user:", userError.message);
      return { error: userError.message, profile: null };
    }

    if (!user) {
      router.replace("/login");
      return { error: "User is not logged in.", profile: null };
    }

    console.log("user", user.id);

    const { data: profiles, error: profileError } = await supabase
      .from("users_profiles")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .limit(1);

    const profile = (profiles?.[0] ?? null) as UserProfile | null;
    console.log("profile", profile);

    if (profileError) {
      console.error("Could not load user profile:", profileError.message);
      return { error: profileError.message, profile: null };
    }

    if (!profile) {
      console.error("No profile found for this user.");
      return { error: "No profile found for this user", profile: null };
    }

    if (!profile.restaurant_id) {
      console.error("User profile has no restaurant_id.", profile);
      return { error: "User profile has no restaurant_id.", profile: null };
    }

    return { error: null, profile };
  }, [router]);

  const loadSuppliers = useCallback(
    async (isMounted = true) => {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();
      const { error: profileLoadError, profile } = await getUserProfile();

      if (profileLoadError || !profile?.restaurant_id) {
        if (isMounted) {
          setErrors([profileLoadError ?? "User profile has no restaurant_id."]);
          setIsLoading(false);
        }
        return;
      }

      const [supplierResult, invoiceResult] = await Promise.all([
        supabase
          .from("suppliers")
          .select(
            "id, active, name, company_name, pib, account_number, contact_name, phone",
          )
          .eq("restaurant_id", profile.restaurant_id)
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("invoices")
          .select(
            `
              invoice_date,
              suppliers (
                name
              ),
              invoice_items (
                total_price
              )
            `,
          )
          .eq("restaurant_id", profile.restaurant_id),
      ]);

      if (!isMounted) {
        return;
      }

      const nextErrors = [
        supplierResult.error
          ? `Could not load suppliers: ${supplierResult.error.message}`
          : "",
        invoiceResult.error
          ? `Could not load supplier cost analysis: ${invoiceResult.error.message}`
          : "",
      ].filter(Boolean);

      if (supplierResult.error) {
        console.error("Could not load suppliers:", supplierResult.error.message);
      }

      if (invoiceResult.error) {
        console.error(
          "Could not load supplier cost analysis:",
          invoiceResult.error.message,
        );
      }

      setErrors(nextErrors);
      setSuppliers((supplierResult.data ?? []) as Supplier[]);
      setAnalysisInvoices((invoiceResult.data ?? []) as Invoice[]);
      setIsLoading(false);
    },
    [getUserProfile],
  );

  useEffect(() => {
    let isMounted = true;

    loadSuppliers(isMounted);

    return () => {
      isMounted = false;
    };
  }, [loadSuppliers]);

  async function handleCreateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const supabase = getSupabaseBrowserClient();
    const { error: profileLoadError, profile } = await getUserProfile();

    if (profileLoadError || !profile?.restaurant_id) {
      setErrors([profileLoadError ?? "User profile has no restaurant_id."]);
      return;
    }

    const { error: insertError } = await supabase.from("suppliers").insert({
      restaurant_id: profile.restaurant_id,
      name: String(formData.get("name") ?? "").trim(),
      company_name: String(formData.get("company_name") ?? "").trim(),
      pib: String(formData.get("pib") ?? "").trim(),
      account_number: String(formData.get("account_number") ?? "").trim(),
      contact_name: String(formData.get("contact_name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
    });

    if (insertError) {
      console.error("Could not create supplier:", insertError.message);
      setErrors([insertError.message]);
      return;
    }

    form.reset();
    await loadSuppliers();
  }

  async function handleUpdateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingSupplier) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const supabase = getSupabaseBrowserClient();
    const { error: profileLoadError, profile } = await getUserProfile();

    if (profileLoadError || !profile?.restaurant_id) {
      setErrors([profileLoadError ?? "User profile has no restaurant_id."]);
      return;
    }

    const { error: updateError } = await supabase
      .from("suppliers")
      .update({
        name: String(formData.get("name") ?? "").trim(),
        company_name: String(formData.get("company_name") ?? "").trim(),
        pib: String(formData.get("pib") ?? "").trim(),
        account_number: String(formData.get("account_number") ?? "").trim(),
        contact_name: String(formData.get("contact_name") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim(),
      })
      .eq("id", editingSupplier.id)
      .eq("restaurant_id", profile.restaurant_id);

    if (updateError) {
      console.error("Could not update supplier:", updateError.message);
      setErrors([updateError.message]);
      return;
    }

    setEditingSupplier(null);
    await loadSuppliers();
  }

  async function handleDeactivateSupplier(supplier: Supplier) {
    const confirmed = window.confirm(
      `Delete supplier "${supplier.name ?? `Supplier ${supplier.id}`}"? This will deactivate it.`,
    );

    if (!confirmed) return;

    const supabase = getSupabaseBrowserClient();
    const { error: profileLoadError, profile } = await getUserProfile();

    if (profileLoadError || !profile?.restaurant_id) {
      setErrors([profileLoadError ?? "User profile has no restaurant_id."]);
      return;
    }

    const { error: deleteError } = await supabase
      .from("suppliers")
      .update({ active: false })
      .eq("id", supplier.id)
      .eq("restaurant_id", profile.restaurant_id);

    if (deleteError) {
      console.error("Could not deactivate supplier:", deleteError.message);
      setErrors([deleteError.message]);
      return;
    }

    if (editingSupplier?.id === supplier.id) {
      setEditingSupplier(null);
    }

    await loadSuppliers();
  }

  const supplierCostAnalysis = useMemo(() => {
    return Object.values(
      analysisInvoices
        .filter((invoice) =>
          isInDateRange(invoice.invoice_date, fromDate, toDate),
        )
        .reduce<Record<string, SupplierCostAnalysis>>((acc, invoice) => {
          const supplier = getRelatedItem(invoice.suppliers);
          const supplierName = supplier?.name ?? "Unknown supplier";

          (invoice.invoice_items ?? []).forEach((item) => {
            const current = acc[supplierName] ?? {
              number_of_invoice_items: 0,
              supplier_name: supplierName,
              total_cost: 0,
            };

            acc[supplierName] = {
              number_of_invoice_items: current.number_of_invoice_items + 1,
              supplier_name: supplierName,
              total_cost: current.total_cost + (item.total_price ?? 0),
            };
          });

          return acc;
        }, {}),
    ).sort((a, b) => b.total_cost - a.total_cost);
  }, [analysisInvoices, fromDate, toDate]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Suppliers</h1>
          <p>Create and manage suppliers.</p>
        </div>
      </div>

      {isLoading ? <div className="empty-state">Loading suppliers...</div> : null}

      {errors.length > 0 ? (
        <div className="error-state">
          <strong>Could not load supplier data.</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <div className="error-state">
          <strong>Could not save supplier.</strong>
          <p>{saveError}</p>
        </div>
      ) : null}

      {!isLoading ? (
        <form className="form-card inventory-form" onSubmit={handleCreateSupplier}>
          <label>
            Name
            <input name="name" required type="text" />
          </label>

          <label>
            Company name
            <input name="company_name" type="text" />
          </label>

          <label>
            PIB
            <input name="pib" type="text" />
          </label>

          <label>
            Account number
            <input name="account_number" type="text" />
          </label>

          <label>
            Contact name
            <input name="contact_name" type="text" />
          </label>

          <label>
            Phone
            <input name="phone" type="text" />
          </label>

          <button className="button" type="submit">
            Create supplier
          </button>
        </form>
      ) : null}

      {editingSupplier ? (
        <form className="form-card inventory-form" onSubmit={handleUpdateSupplier}>
          <h2>Edit supplier</h2>

          <label>
            Name
            <input
              defaultValue={editingSupplier.name ?? ""}
              name="name"
              required
              type="text"
            />
          </label>

          <label>
            Company name
            <input
              defaultValue={editingSupplier.company_name ?? ""}
              name="company_name"
              type="text"
            />
          </label>

          <label>
            PIB
            <input defaultValue={editingSupplier.pib ?? ""} name="pib" type="text" />
          </label>

          <label>
            Account number
            <input
              defaultValue={editingSupplier.account_number ?? ""}
              name="account_number"
              type="text"
            />
          </label>

          <label>
            Contact name
            <input
              defaultValue={editingSupplier.contact_name ?? ""}
              name="contact_name"
              type="text"
            />
          </label>

          <label>
            Phone
            <input
              defaultValue={editingSupplier.phone ?? ""}
              name="phone"
              type="text"
            />
          </label>

          <button className="button" type="submit">
            Save changes
          </button>
          <button
            className="button secondary"
            onClick={() => setEditingSupplier(null)}
            type="button"
          >
            Cancel
          </button>
        </form>
      ) : null}

      {suppliers.length === 0 && !isLoading && errors.length === 0 ? (
        <div className="empty-state">No suppliers yet.</div>
      ) : null}

      {suppliers.length > 0 ? (
        <table className="items-table inventory-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company name</th>
              <th>PIB</th>
              <th>Account number</th>
              <th>Contact name</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td>{supplier.name ?? "-"}</td>
                <td>{supplier.company_name ?? "-"}</td>
                <td>{supplier.pib ?? "-"}</td>
                <td>{supplier.account_number ?? "-"}</td>
                <td>{supplier.contact_name ?? "-"}</td>
                <td>{supplier.phone ?? "-"}</td>
                <td>
                  <button
                    className="button secondary"
                    onClick={() => setEditingSupplier(supplier)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => handleDeactivateSupplier(supplier)}
                    type="button"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <section className="dashboard-section">
        <h2>Supplier cost analysis</h2>

        <form className="form-card kpi-filters">
          <label>
            From date
            <input defaultValue={fromDate} name="from_date" type="date" />
          </label>

          <label>
            To date
            <input defaultValue={toDate} name="to_date" type="date" />
          </label>

          <button className="button" type="submit">
            Apply filters
          </button>
        </form>

        {supplierCostAnalysis.length > 0 ? (
          <table className="items-table inventory-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th className="number">Total cost</th>
                <th className="number">Invoice items</th>
              </tr>
            </thead>
            <tbody>
              {supplierCostAnalysis.map((row) => (
                <tr key={row.supplier_name}>
                  <td>{row.supplier_name}</td>
                  <td className="number">{formatAmount(row.total_cost)}</td>
                  <td className="number">{row.number_of_invoice_items}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !isLoading ? (
          <div className="empty-state">No supplier cost data yet.</div>
        ) : null}
      </section>
    </main>
  );
}
