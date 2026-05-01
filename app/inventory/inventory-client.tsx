"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { createInventoryItem } from "./actions";

type CostSubcategory = {
  id: number;
  name: string | null;
};

type InventoryItem = {
  id: number;
  name: string | null;
  unit: string | null;
  base_unit: string | null;
  base_unit_cost: number | null;
  cost_subcategory_id: number | null;
  minimum_stock: number | null;
  active: boolean | null;
  cost_subcategories:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
};

type UserProfile = {
  restaurant_id: string | null;
};

type InventoryClientProps = {
  saveError?: string;
};

function dedupeByName<T extends { name: string | null }>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = (item.name ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(value);
}

function getSubcategoryName(
  subcategory: InventoryItem["cost_subcategories"],
): string | null {
  if (Array.isArray(subcategory)) {
    return subcategory[0]?.name ?? null;
  }

  return subcategory?.name ?? null;
}

export function InventoryClient({ saveError }: InventoryClientProps) {
  const router = useRouter();
  const [costSubcategories, setCostSubcategories] = useState<CostSubcategory[]>(
    [],
  );
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
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
      .from("users_profiles")
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

  const loadInventory = useCallback(
    async (isMounted = true) => {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();
      const restaurantId = await getRestaurantId();

      if (!restaurantId) {
        if (isMounted) setIsLoading(false);
        return;
      }

      const [subcategoryResult, inventoryResult] = await Promise.all([
        supabase
          .from("cost_subcategories")
          .select("id, name")
          .eq("restaurant_id", restaurantId)
          .order("name", { ascending: true }),
        supabase
          .from("inventory_items")
          .select(
            `
              id,
              name,
              unit,
              base_unit,
              base_unit_cost,
              cost_subcategory_id,
              minimum_stock,
              active,
              cost_subcategories (
                name
              )
            `,
          )
          .eq("restaurant_id", restaurantId)
          .eq("active", true)
          .order("name", { ascending: true }),
      ]);

      if (!isMounted) {
        return;
      }

      const nextErrors = [
        subcategoryResult.error
          ? `Could not load cost subcategories: ${subcategoryResult.error.message}`
          : "",
        inventoryResult.error
          ? `Could not load inventory items: ${inventoryResult.error.message}`
          : "",
      ].filter(Boolean);

      nextErrors.forEach((error) => console.log(error));

      setErrors(nextErrors);
      setCostSubcategories(
        dedupeByName((subcategoryResult.data ?? []) as CostSubcategory[]),
      );
      setInventoryItems(
        dedupeByName((inventoryResult.data ?? []) as InventoryItem[]),
      );
      setIsLoading(false);
    },
    [getRestaurantId],
  );

  useEffect(() => {
    let isMounted = true;

    loadInventory(isMounted);

    return () => {
      isMounted = false;
    };
  }, [loadInventory]);

  async function handleUpdateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingItem) return;

    const formData = new FormData(event.currentTarget);
    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({
        base_unit: String(formData.get("base_unit") ?? ""),
        base_unit_cost: Number(formData.get("base_unit_cost")),
        cost_subcategory_id: Number(formData.get("cost_subcategory_id")),
        minimum_stock: Number(formData.get("minimum_stock")),
        name: String(formData.get("name") ?? "").trim(),
        unit: String(formData.get("unit") ?? ""),
      })
      .eq("id", editingItem.id)
      .eq("restaurant_id", restaurantId);

    if (updateError) {
      console.error("Could not update inventory item:", updateError);
      setErrors([updateError.message]);
      return;
    }

    setEditingItem(null);
    await loadInventory();
  }

  async function handleDeactivateItem(item: InventoryItem) {
    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const [recipeUsage, menuUsage] = await Promise.all([
      supabase
        .from("recipe_items")
        .select("id", { count: "exact", head: true })
        .eq("inventory_item_id", item.id),
      supabase
        .from("menu_item_components")
        .select("id", { count: "exact", head: true })
        .eq("inventory_item_id", item.id),
    ]);

    if (recipeUsage.error || menuUsage.error) {
      console.error("Could not check inventory item usage:", {
        menuError: menuUsage.error,
        recipeError: recipeUsage.error,
      });
      setErrors([
        recipeUsage.error?.message ??
          menuUsage.error?.message ??
          "Could not check inventory item usage.",
      ]);
      return;
    }

    const usageCount = (recipeUsage.count ?? 0) + (menuUsage.count ?? 0);
    if (usageCount > 0) {
      window.alert(
        "This inventory item is used in recipes or menu components. Remove those links before deleting it.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete inventory item "${item.name ?? `Item ${item.id}`}"? This will deactivate it.`,
    );

    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("inventory_items")
      .update({ active: false })
      .eq("id", item.id)
      .eq("restaurant_id", restaurantId);

    if (deleteError) {
      console.error("Could not deactivate inventory item:", deleteError);
      setErrors([deleteError.message]);
      return;
    }

    if (editingItem?.id === item.id) {
      setEditingItem(null);
    }

    await loadInventory();
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p>Simple inventory items list.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state">Loading inventory...</div>
      ) : null}

      {errors.length > 0 ? (
        <div className="error-state">
          <strong>Could not load inventory data.</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <div className="error-state">
          <strong>Could not save inventory item.</strong>
          <p>{saveError}</p>
        </div>
      ) : null}

      {!isLoading ? (
        <form action={createInventoryItem} className="form-card inventory-form">
          <label>
            Name
            <input name="name" required type="text" />
          </label>

          <label>
            Purchase unit
            <select name="unit" required>
              <option value="">Select purchase unit</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="l">l</option>
              <option value="ml">ml</option>
              <option value="pcs">pcs</option>
            </select>
          </label>

          <label>
            Base unit
            <select name="base_unit" required>
              <option value="">Select base unit</option>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="pcs">pcs</option>
            </select>
          </label>

          <label>
            Base unit cost
            <input
              min="0"
              name="base_unit_cost"
              required
              step="0.000001"
              type="number"
            />
          </label>

          <label>
            Cost subcategory
            <select
              disabled={costSubcategories.length === 0}
              name="cost_subcategory_id"
              required
            >
              <option value="">Select subcategory</option>
              {costSubcategories.map((costSubcategory) => (
                <option key={costSubcategory.id} value={costSubcategory.id}>
                  {costSubcategory.name ?? `Subcategory ${costSubcategory.id}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            Minimum stock
            <input
              min="0"
              name="minimum_stock"
              required
              step="0.01"
              type="number"
            />
          </label>

          <label className="checkbox-label">
            <input defaultChecked name="active" type="checkbox" />
            Active
          </label>

          <button
            className="button"
            disabled={costSubcategories.length === 0}
            type="submit"
          >
            Save inventory item
          </button>
        </form>
      ) : null}

      {inventoryItems.length === 0 && !isLoading && errors.length === 0 ? (
        <div className="empty-state">No active inventory items found.</div>
      ) : null}

      {editingItem ? (
        <form className="form-card inventory-form" onSubmit={handleUpdateItem}>
          <h2>Edit inventory item</h2>

          <label>
            Name
            <input
              defaultValue={editingItem.name ?? ""}
              name="name"
              required
              type="text"
            />
          </label>

          <label>
            Purchase unit
            <select defaultValue={editingItem.unit ?? ""} name="unit" required>
              <option value="">Select purchase unit</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="l">l</option>
              <option value="ml">ml</option>
              <option value="pcs">pcs</option>
            </select>
          </label>

          <label>
            Base unit
            <select
              defaultValue={editingItem.base_unit ?? ""}
              name="base_unit"
              required
            >
              <option value="">Select base unit</option>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="pcs">pcs</option>
            </select>
          </label>

          <label>
            Base unit cost
            <input
              defaultValue={editingItem.base_unit_cost ?? ""}
              min="0"
              name="base_unit_cost"
              required
              step="0.000001"
              type="number"
            />
          </label>

          <label>
            Cost subcategory
            <select
              defaultValue={editingItem.cost_subcategory_id ?? ""}
              disabled={costSubcategories.length === 0}
              name="cost_subcategory_id"
              required
            >
              <option value="">Select subcategory</option>
              {costSubcategories.map((costSubcategory) => (
                <option key={costSubcategory.id} value={costSubcategory.id}>
                  {costSubcategory.name ?? `Subcategory ${costSubcategory.id}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            Minimum stock
            <input
              defaultValue={editingItem.minimum_stock ?? ""}
              min="0"
              name="minimum_stock"
              required
              step="0.01"
              type="number"
            />
          </label>

          <button className="button" type="submit">
            Save changes
          </button>
          <button
            className="button secondary"
            onClick={() => setEditingItem(null)}
            type="button"
          >
            Cancel
          </button>
        </form>
      ) : null}

      {inventoryItems.length > 0 ? (
        <table className="items-table inventory-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Purchase unit</th>
              <th>Base unit</th>
              <th className="number">Base unit cost</th>
              <th>Subcategory</th>
              <th className="number">Minimum stock</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventoryItems.map((item) => (
              <tr key={item.id}>
                <td>{item.name ?? "-"}</td>
                <td>{item.unit ?? "-"}</td>
                <td>{item.base_unit ?? "-"}</td>
                <td className="number">{formatAmount(item.base_unit_cost)}</td>
                <td>{getSubcategoryName(item.cost_subcategories) ?? "-"}</td>
                <td className="number">{formatAmount(item.minimum_stock)}</td>
                <td>{item.active ? "Yes" : "No"}</td>
                <td>
                  <button
                    className="button secondary"
                    onClick={() => setEditingItem(item)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => handleDeactivateItem(item)}
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
    </main>
  );
}
