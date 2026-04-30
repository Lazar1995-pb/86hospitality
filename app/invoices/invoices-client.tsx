"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type InvoiceItem = {
  cost_category_id: number | null;
  id: number;
  item_name: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
};

type Invoice = {
  id: number;
  supplier_id: number | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total: number | null;
  suppliers:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
  invoice_items: InvoiceItem[];
};

type CostCategory = {
  id: number;
  name: string | null;
};

type Supplier = {
  id: number;
  name: string | null;
  company_name: string | null;
};

type UserProfile = {
  restaurant_id: number | null;
};

function formatDate(value: string | null) {
  if (!value) return "No date";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getSupplierName(supplier: Invoice["suppliers"]): string | null {
  if (Array.isArray(supplier)) {
    return supplier[0]?.name ?? null;
  }

  return supplier?.name ?? null;
}

export function InvoicesClient() {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState("");
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [toDate, setToDate] = useState("");

  const getRestaurantId = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Could not load authenticated user:", userError);
      setError(userError.message);
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
      setError(profileError?.message ?? "No restaurant profile found.");
      return null;
    }

    return (profile as UserProfile).restaurant_id;
  }, [router]);

  const loadInvoices = useCallback(
    async (isMounted = true) => {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();
      const restaurantId = await getRestaurantId();

      if (!restaurantId) {
        if (isMounted) setIsLoading(false);
        return;
      }

      const [invoiceResult, categoryResult, supplierResult] = await Promise.all([
        supabase
          .from("invoices")
          .select(
            `
              id,
              supplier_id,
              invoice_number,
              invoice_date,
              total,
              suppliers (
                name
              ),
              invoice_items (
                id,
                cost_category_id,
                item_name,
                quantity,
                unit,
                unit_price,
                total_price
              )
            `,
          )
          .eq("restaurant_id", restaurantId)
          .order("invoice_date", { ascending: false }),
        supabase
          .from("cost_categories")
          .select("id, name")
          .eq("restaurant_id", restaurantId)
          .order("name", { ascending: true }),
        supabase
          .from("suppliers")
          .select("id, name, company_name")
          .eq("restaurant_id", restaurantId)
          .eq("active", true)
          .order("name", { ascending: true }),
      ]);

      if (!isMounted) {
        return;
      }

      if (invoiceResult.error || categoryResult.error || supplierResult.error) {
        if (invoiceResult.error) {
          console.error("Could not load invoices:", invoiceResult.error);
        }

        if (categoryResult.error) {
          console.error("Could not load cost categories:", categoryResult.error);
        }

        if (supplierResult.error) {
          console.error("Could not load suppliers:", supplierResult.error);
        }

        setError(
          invoiceResult.error?.message ??
            categoryResult.error?.message ??
            supplierResult.error?.message ??
            "Could not load invoices.",
        );
      } else {
        setInvoices((invoiceResult.data ?? []) as Invoice[]);
        setCostCategories((categoryResult.data ?? []) as CostCategory[]);
        setSuppliers((supplierResult.data ?? []) as Supplier[]);
        setError("");
      }

      setIsLoading(false);
    },
    [getRestaurantId],
  );

  useEffect(() => {
    let isMounted = true;

    loadInvoices(isMounted);

    return () => {
      isMounted = false;
    };
  }, [loadInvoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (categoryId) {
        const hasCategory = (invoice.invoice_items ?? []).some(
          (item) => String(item.cost_category_id) === categoryId,
        );

        if (!hasCategory) return false;
      }

      if (fromDate && (!invoice.invoice_date || invoice.invoice_date < fromDate)) {
        return false;
      }

      if (toDate && (!invoice.invoice_date || invoice.invoice_date > toDate)) {
        return false;
      }

      return true;
    });
  }, [categoryId, fromDate, invoices, toDate]);

  const selectedCategoryName =
    costCategories.find((category) => String(category.id) === categoryId)
      ?.name ?? "All categories";

  function getVisibleInvoiceItems(invoice: Invoice) {
    if (!categoryId) {
      return invoice.invoice_items ?? [];
    }

    return (invoice.invoice_items ?? []).filter(
      (item) => String(item.cost_category_id) === categoryId,
    );
  }

  const filteredTotal = filteredInvoices.reduce(
    (sum, invoice) =>
      sum +
      getVisibleInvoiceItems(invoice).reduce(
        (itemSum, item) => itemSum + (item.total_price ?? 0),
        0,
      ),
    0,
  );

  function getInvoiceCategoryId(invoice: Invoice) {
    const itemWithCategory = (invoice.invoice_items ?? []).find(
      (item) => item.cost_category_id,
    );

    return itemWithCategory?.cost_category_id ?? null;
  }

  async function handleUpdateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingInvoice) return;

    const formData = new FormData(event.currentTarget);
    const supplierId = Number(formData.get("supplier_id"));
    const invoiceNumber = String(formData.get("invoice_number") ?? "").trim();
    const invoiceDate = String(formData.get("invoice_date") ?? "");
    const total = Number(formData.get("total"));
    const costCategoryId = Number(formData.get("cost_category_id"));

    if (!supplierId || !invoiceNumber || !invoiceDate || !total || !costCategoryId) {
      setError("Supplier, invoice number, invoice date, total, and KPI category are required.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({
        invoice_date: invoiceDate,
        invoice_number: invoiceNumber,
        supplier_id: supplierId,
        total,
      })
      .eq("id", editingInvoice.id)
      .eq("restaurant_id", restaurantId);

    if (invoiceError) {
      console.error("Could not update invoice:", invoiceError);
      setError(invoiceError.message);
      return;
    }

    const { error: deleteItemsError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", editingInvoice.id)
      .eq("restaurant_id", restaurantId);

    if (deleteItemsError) {
      console.error("Could not update invoice items:", deleteItemsError);
      setError(deleteItemsError.message);
      return;
    }

    const { error: itemError } = await supabase.from("invoice_items").insert({
      cost_category_id: costCategoryId,
      invoice_id: editingInvoice.id,
      item_name: "Invoice total",
      quantity: 1,
      restaurant_id: restaurantId,
      total_price: total,
      unit_price: total,
    });

    if (itemError) {
      console.error("Could not save invoice item:", itemError);
      setError(itemError.message);
      return;
    }

    setEditingInvoice(null);
    await loadInvoices();
  }

  async function handleDeleteInvoice(invoice: Invoice) {
    const confirmed = window.confirm(
      `Delete invoice "${invoice.invoice_number ?? `Invoice ${invoice.id}`}"?`,
    );

    if (!confirmed) return;

    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error: itemError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", invoice.id)
      .eq("restaurant_id", restaurantId);

    if (itemError) {
      console.error("Could not delete invoice items:", itemError);
      setError(itemError.message);
      return;
    }

    const { error: invoiceError } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoice.id)
      .eq("restaurant_id", restaurantId);

    if (invoiceError) {
      console.error("Could not delete invoice:", invoiceError);
      setError(invoiceError.message);
      return;
    }

    if (editingInvoice?.id === invoice.id) {
      setEditingInvoice(null);
    }

    await loadInvoices();
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>Simple invoice list from Supabase.</p>
        </div>
        <Link className="button" href="/invoices/new">
          New invoice
        </Link>
      </div>

      {isLoading ? <div className="empty-state">Loading invoices...</div> : null}

      {error ? (
        <div className="error-state">
          <strong>Could not load invoices.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {!isLoading && !error && invoices.length === 0 ? (
        <div className="empty-state">No invoices found.</div>
      ) : null}

      {!isLoading && !error ? (
        <>
          <form className="form-card kpi-filters">
            <label>
              KPI category
              <select
                onChange={(event) => setCategoryId(event.target.value)}
                value={categoryId}
              >
                <option value="">All categories</option>
                {costCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name ?? `Category ${category.id}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              From date
              <input
                onChange={(event) => setFromDate(event.target.value)}
                type="date"
                value={fromDate}
              />
            </label>

            <label>
              To date
              <input
                onChange={(event) => setToDate(event.target.value)}
                type="date"
                value={toDate}
              />
            </label>
          </form>

          <div className="summary-grid">
            <div className="summary-card">
              <span className="label">Invoices</span>
              <span className="value">{filteredInvoices.length}</span>
            </div>
            <div className="summary-card">
              <span className="label">Total amount</span>
              <span className="value">{formatAmount(filteredTotal)}</span>
            </div>
            <div className="summary-card">
              <span className="label">Selected category</span>
              <span className="value">{selectedCategoryName}</span>
            </div>
          </div>
        </>
      ) : null}

      {!isLoading && !error && invoices.length > 0 && filteredInvoices.length === 0 ? (
        <div className="empty-state">No invoices match these filters.</div>
      ) : null}

      <div className="invoice-list">
        {filteredInvoices.map((invoice) => {
          const visibleItems = getVisibleInvoiceItems(invoice);

          return (
            <section className="invoice-card" key={invoice.id}>
              <div className="invoice-summary">
                <div>
                  <span className="label">Supplier</span>
                  <span className="value">
                    {getSupplierName(invoice.suppliers) ?? "Unknown supplier"}
                  </span>
                </div>
                <div>
                  <span className="label">Invoice number</span>
                  <span className="value">
                    {invoice.invoice_number ?? `Invoice ${invoice.id}`}
                  </span>
                </div>
                <div>
                  <span className="label">Date</span>
                  <span className="value">{formatDate(invoice.invoice_date)}</span>
                </div>
                <div>
                  <span className="label">Total</span>
                  <span className="value total">{formatAmount(invoice.total)}</span>
                </div>
                <div>
                  <span className="label">Actions</span>
                  <span className="value">
                    <button
                      className="button secondary"
                      onClick={() => setEditingInvoice(invoice)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => handleDeleteInvoice(invoice)}
                      type="button"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </div>

              {editingInvoice?.id === invoice.id ? (
                <form
                  className="form-card inventory-form"
                  onSubmit={handleUpdateInvoice}
                >
                  <label>
                    Supplier
                    <select
                      defaultValue={invoice.supplier_id ?? ""}
                      name="supplier_id"
                      required
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.company_name
                            ? `${supplier.name ?? `Supplier ${supplier.id}`} (${supplier.company_name})`
                            : supplier.name ?? `Supplier ${supplier.id}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Invoice number
                    <input
                      defaultValue={invoice.invoice_number ?? ""}
                      name="invoice_number"
                      required
                      type="text"
                    />
                  </label>

                  <label>
                    Invoice date
                    <input
                      defaultValue={invoice.invoice_date ?? ""}
                      name="invoice_date"
                      required
                      type="date"
                    />
                  </label>

                  <label>
                    Total
                    <input
                      defaultValue={invoice.total ?? ""}
                      min="0"
                      name="total"
                      required
                      step="0.01"
                      type="number"
                    />
                  </label>

                  <label>
                    KPI category
                    <select
                      defaultValue={getInvoiceCategoryId(invoice) ?? ""}
                      name="cost_category_id"
                      required
                    >
                      <option value="">Select category</option>
                      {costCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name ?? `Category ${category.id}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button className="button" type="submit">
                    Save changes
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => setEditingInvoice(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </form>
              ) : null}

              {visibleItems.length > 0 ? (
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="number">Qty</th>
                      <th>Unit</th>
                      <th className="number">Unit price</th>
                      <th className="number">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.item_name ?? "Unnamed item"}</td>
                        <td className="number">{item.quantity ?? "-"}</td>
                        <td>{item.unit ?? "-"}</td>
                        <td className="number">{formatAmount(item.unit_price)}</td>
                        <td className="number">{formatAmount(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">No invoice items for this invoice.</p>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
