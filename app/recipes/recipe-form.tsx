"use client";

import { useMemo, useState } from "react";
import { createRecipe } from "./actions";

type InventoryItem = {
  id: number;
  name: string | null;
  base_unit: string | null;
  base_unit_cost: number | null;
};

type IngredientRow = {
  id: number;
  inventoryItemId: string;
  quantity: string;
  unit: string;
};

type RecipeFormProps = {
  inventoryItems: InventoryItem[];
};

export function RecipeForm({ inventoryItems }: RecipeFormProps) {
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { id: 1, inventoryItemId: "", quantity: "", unit: "" },
  ]);
  const [yieldQuantity, setYieldQuantity] = useState("");
  const [yieldUnit, setYieldUnit] = useState("g");

  const totalBatchCost = useMemo(
    () =>
      ingredients.reduce((sum, ingredient) => {
        const inventoryItem = inventoryItems.find(
          (item) => String(item.id) === ingredient.inventoryItemId,
        );

        return (
          sum +
          (Number(ingredient.quantity) || 0) *
            (inventoryItem?.base_unit_cost ?? 0)
        );
      }, 0),
    [ingredients, inventoryItems],
  );
  const costPerUnit =
    Number(yieldQuantity) > 0 ? totalBatchCost / Number(yieldQuantity) : null;

  function updateIngredient(id: number, changes: Partial<IngredientRow>) {
    setIngredients((currentIngredients) =>
      currentIngredients.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, ...changes } : ingredient,
      ),
    );
  }

  function getInventoryItem(inventoryItemId: string) {
    return inventoryItems.find((item) => String(item.id) === inventoryItemId);
  }

  return (
    <form action={createRecipe} className="form-card recipe-form">
      <input name="total_cost" type="hidden" value={totalBatchCost} />
      <input name="cost_per_unit" type="hidden" value={costPerUnit ?? 0} />

      <label>
        Semi-product name
        <input name="name" required type="text" />
      </label>

      <label>
        Yield quantity
        <input
          min="0"
          name="yield_quantity"
          onChange={(event) => setYieldQuantity(event.target.value)}
          required
          step="0.01"
          type="number"
          value={yieldQuantity}
        />
      </label>

      <label>
        Yield unit
        <select
          name="yield_unit"
          onChange={(event) => setYieldUnit(event.target.value)}
          required
          value={yieldUnit}
        >
          <option value="g">g</option>
          <option value="ml">ml</option>
          <option value="pcs">pcs</option>
        </select>
      </label>

      <label className="checkbox-label">
        <input defaultChecked name="active" type="checkbox" />
        Active
      </label>

      <div className="form-section">
        <div className="form-section-header">
          <h2>Ingredients</h2>
          <button
            className="button secondary"
            onClick={() =>
              setIngredients((currentIngredients) => [
                ...currentIngredients,
                { id: Date.now(), inventoryItemId: "", quantity: "", unit: "" },
              ])
            }
            type="button"
          >
            Add ingredient
          </button>
        </div>

        <div className="item-list">
          {ingredients.map((ingredient) => {
            const inventoryItem = getInventoryItem(ingredient.inventoryItemId);
            const lineCost =
              (Number(ingredient.quantity) || 0) *
              (inventoryItem?.base_unit_cost ?? 0);

            return (
              <div className="recipe-item-row" key={ingredient.id}>
                <label>
                  Inventory item
                  <select
                    disabled={inventoryItems.length === 0}
                    name="inventory_item_id"
                    onChange={(event) => {
                      const selectedItem = getInventoryItem(event.target.value);

                      updateIngredient(ingredient.id, {
                        inventoryItemId: event.target.value,
                        unit: selectedItem?.base_unit ?? "",
                      });
                    }}
                    required
                    value={ingredient.inventoryItemId}
                  >
                    <option value="">Select inventory item</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name ?? `Inventory item ${item.id}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Quantity
                  <input
                    min="0"
                    name="quantity"
                    onChange={(event) =>
                      updateIngredient(ingredient.id, {
                        quantity: event.target.value,
                      })
                    }
                    required
                    step="0.01"
                    type="number"
                    value={ingredient.quantity}
                  />
                </label>

                <label>
                  Unit
                  <input
                    name="unit"
                    onChange={(event) =>
                      updateIngredient(ingredient.id, { unit: event.target.value })
                    }
                    required
                    type="text"
                    value={ingredient.unit}
                  />
                </label>

                <div>
                  <span className="label">Base unit cost</span>
                  <span>{formatAmount(inventoryItem?.base_unit_cost ?? null)}</span>
                </div>

                <div>
                  <span className="label">Line cost</span>
                  <span>{formatAmount(lineCost)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <span className="label">Estimated batch cost</span>
        <span className="form-total">{formatAmount(totalBatchCost)}</span>
      </div>

      <div>
        <span className="label">Cost per yield unit</span>
        <span className="form-total">{formatAmount(costPerUnit)}</span>
      </div>

      <button
        className="button"
        disabled={inventoryItems.length === 0}
        type="submit"
      >
        Save semi-product
      </button>
    </form>
  );
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}
