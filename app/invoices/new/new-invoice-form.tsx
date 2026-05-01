"use client";

import { FormEvent, useState } from "react";
import { createInvoice } from "./actions";

type Supplier = {
  id: number;
  name: string | null;
  company_name: string | null;
};

type CostCategory = {
  id: number;
  name: string | null;
  restaurant_id: string | null;
};

type CostSubcategory = {
  id: number;
  name: string | null;
  cost_category_id: number | null;
};

type NewInvoiceFormProps = {
  costCategories: CostCategory[];
  costSubcategories: CostSubcategory[];
  suppliers: Supplier[];
};

export function NewInvoiceForm({
  costCategories,
  costSubcategories,
  suppliers,
}: NewInvoiceFormProps) {
  const [costCategoryId, setCostCategoryId] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const filteredSubcategories = costSubcategories.filter(
    (subcategory) => String(subcategory.cost_category_id) === costCategoryId,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const nextErrors: string[] = [];

    if (!formData.get("supplier_id")) nextErrors.push("Supplier is required.");
    if (!String(formData.get("invoice_number") ?? "").trim()) {
      nextErrors.push("Invoice number is required.");
    }
    if (!formData.get("invoice_date")) nextErrors.push("Invoice date is required.");
    if (!formData.get("total")) nextErrors.push("Total is required.");
    if (!formData.get("cost_category_id")) {
      nextErrors.push("KPI category is required.");
    }

    setErrors(nextErrors);

    if (nextErrors.length > 0) {
      event.preventDefault();
    }
  }

  return (
    <form action={createInvoice} className="form-card" onSubmit={handleSubmit}>
      {errors.length > 0 ? (
        <div className="error-state">
          <strong>Please fix these fields.</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label>
        Supplier
        <select name="supplier_id" disabled={suppliers.length === 0}>
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
        <input name="invoice_number" type="text" />
      </label>

      <label>
        Invoice date
        <input name="invoice_date" type="date" />
      </label>

      <label>
        Total
        <input min="0" name="total" step="0.01" type="number" />
      </label>

      <label>
        KPI category
        <select
          disabled={costCategories.length === 0}
          name="cost_category_id"
          onChange={(event) => setCostCategoryId(event.target.value)}
          required
          value={costCategoryId}
        >
          <option value="">Select category</option>
          {costCategories.map((costCategory) => (
            <option key={costCategory.id} value={costCategory.id}>
              {costCategory.name ?? `Category ${costCategory.id}`}
            </option>
          ))}
        </select>
      </label>

      {costCategoryId ? (
        <label>
          Cost subcategory
          <select name="cost_subcategory_id">
            <option value="">No subcategory</option>
            {filteredSubcategories.map((costSubcategory) => (
              <option key={costSubcategory.id} value={costSubcategory.id}>
                {costSubcategory.name ?? `Subcategory ${costSubcategory.id}`}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input name="cost_subcategory_id" readOnly type="hidden" value="" />
      )}

      <label>
        Note
        <input name="note" type="text" />
      </label>

      <button
        className="button"
        disabled={suppliers.length === 0 || costCategories.length === 0}
        type="submit"
      >
        Save invoice
      </button>
    </form>
  );
}
