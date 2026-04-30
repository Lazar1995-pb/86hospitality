"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { useState } from "react";

type InventoryItem = {
  id: number;
  name: string | null;
  base_unit: string | null;
  base_unit_cost: number | null;
};

type SemiProduct = {
  id: number;
  name: string | null;
  cost_per_unit: number | null;
  yield_unit: string | null;
};

type MenuComponentFormProps = {
  inventoryItems: InventoryItem[];
  menuItemId: number;
  semiProducts: SemiProduct[];
};

export function MenuComponentForm({
  inventoryItems,
  menuItemId,
  semiProducts,
}: MenuComponentFormProps) {
  const router = useRouter();
  const [componentType, setComponentType] = useState<"inventory" | "recipe">(
    "inventory",
  );
  const [componentId, setComponentId] = useState("");
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState("");
  const options = componentType === "inventory" ? inventoryItems : semiProducts;
  const selectedComponent = options.find(
    (option) => String(option.id) === componentId,
  );
  const selectedUnit =
    componentType === "inventory"
      ? (selectedComponent as InventoryItem | undefined)?.base_unit
      : (selectedComponent as SemiProduct | undefined)?.yield_unit;
  const selectedUnitCost =
    componentType === "inventory"
      ? (selectedComponent as InventoryItem | undefined)?.base_unit_cost
      : (selectedComponent as SemiProduct | undefined)?.cost_per_unit;
  const lineCost = (Number(quantity) || 0) * (selectedUnitCost ?? 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Could not load authenticated user:", userError);
      setError(userError?.message ?? "User is not logged in.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !profile?.restaurant_id) {
      console.error("Could not load user profile:", profileError);
      setError("No restaurant profile found.");
      return;
    }

    const { error: insertError } = await supabase
      .from("menu_item_components")
      .insert({
        restaurant_id: profile.restaurant_id,
        menu_item_id: menuItemId,
        inventory_item_id:
          componentType === "inventory" ? Number(componentId) : null,
        recipe_id: componentType === "recipe" ? Number(componentId) : null,
        quantity: Number(quantity),
        unit: selectedUnit ?? "",
      });

    if (insertError) {
      console.error("Could not add menu component:", insertError);
      setError(insertError.message);
      return;
    }

    router.refresh();
    window.location.reload();
  }

  return (
    <form className="component-form" onSubmit={handleSubmit}>
      {error ? (
        <div className="error-state">
          <strong>Could not add component.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <label>
        Component type
        <select
          name="component_type"
          onChange={(event) => {
            setComponentType(event.target.value as "inventory" | "recipe");
            setComponentId("");
          }}
          value={componentType}
        >
          <option value="inventory">Inventory item</option>
          <option value="recipe">Semi-product</option>
        </select>
      </label>

      <label>
        Component
        <select
          name="component_id"
          onChange={(event) => setComponentId(event.target.value)}
          required
          value={componentId}
        >
          <option value="">Select component</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name ?? `Item ${option.id}`}
            </option>
          ))}
        </select>
      </label>

      <label>
        Quantity
        <input
          min="0"
          name="quantity"
          onChange={(event) => setQuantity(event.target.value)}
          required
          step="0.01"
          type="number"
          value={quantity}
        />
      </label>

      <div>
        <span className="label">Unit</span>
        <span>{selectedUnit ?? "-"}</span>
      </div>

      <div>
        <span className="label">Line cost</span>
        <span>{formatAmount(lineCost)}</span>
      </div>

      <button className="button" type="submit">
        Add component
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
