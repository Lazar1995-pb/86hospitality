"use client";

import { useState } from "react";
import { createSale } from "./actions";

export function SalesForm() {
  const [category, setCategory] = useState("food");

  return (
    <form action={createSale} className="form-card inventory-form">
      <label>
        Sale date
        <input name="sale_date" required type="date" />
      </label>

      <label>
        Category
        <select
          name="category"
          onChange={(event) => setCategory(event.target.value)}
          required
          value={category}
        >
          <option value="food">food</option>
          <option value="beverage">beverage</option>
        </select>
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
