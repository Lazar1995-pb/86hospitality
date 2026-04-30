import { createMenuItem } from "./actions";

export function MenuForm() {
  return (
    <form action={createMenuItem} className="form-card inventory-form">
      <label>
        Menu item name
        <input name="name" required type="text" />
      </label>

      <label>
        Selling price
        <input min="0" name="selling_price" required step="0.01" type="number" />
      </label>

      <label className="checkbox-label">
        <input defaultChecked name="active" type="checkbox" />
        Active
      </label>

      <button className="button" type="submit">
        Add menu item
      </button>
    </form>
  );
}
