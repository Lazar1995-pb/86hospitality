"use client";

import { useState } from "react";
import { createSale } from "./actions";

type MenuItem = {
  id: number;
  name: string | null;
  selling_price: number | null;
};

type SalesFormProps = {
  menuItems: MenuItem[];
};

export function SalesForm({ menuItems }: SalesFormProps) {
  const [menuItemId, setMenuItemId] = useState("");

  return (
    <form action={createSale} className="form-card inventory-form">
      <label>
        Sale date
        <input name="sale_date" required type="date" />
      </label>

      <label>
        Menu item
        <select
          disabled={menuItems.length === 0}
          name="menu_item_id"
          onChange={(event) => setMenuItemId(event.target.value)}
          value={menuItemId}
        >
          <option value="">Select menu item</option>
          {menuItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name ?? `Menu item ${item.id}`}
            </option>
          ))}
        </select>
        <span className="field-help">Menu item optional</span>
      </label>

      <label>
        Quantity
        <input min="0" name="quantity" step="0.01" type="number" />
      </label>

      <label>
        Revenue
        <input min="0" name="revenue" required step="0.01" type="number" />
      </label>

      <label>
        Note
        <input name="note" type="text" />
      </label>

      <button className="button" type="submit">
        Save sale
      </button>
    </form>
  );
}
