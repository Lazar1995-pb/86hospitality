"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MenuComponentForm } from "./menu-component-form";
import { MenuForm } from "./menu-form";

type MenuItem = {
  id: number;
  name: string | null;
  selling_price: number | null;
  active: boolean | null;
  theoretical_cost?: number | null;
  gross_profit?: number | null;
};

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

type MenuItemComponent = {
  id: number;
  menu_item_id: number | null;
  inventory_item_id: number | null;
  recipe_id: number | null;
  quantity: number | null;
  unit: string | null;
  inventory_items: RelatedInventoryItem;
  recipes: RelatedRecipe;
};

type RelatedInventoryItem =
  | {
      name: string | null;
      base_unit_cost?: number | null;
      base_unit?: string | null;
    }
  | {
      name: string | null;
      base_unit_cost?: number | null;
      base_unit?: string | null;
    }[]
  | null;

type RelatedRecipe =
  | {
      name: string | null;
      cost_per_unit?: number | null;
      yield_unit?: string | null;
    }
  | {
      name: string | null;
      cost_per_unit?: number | null;
      yield_unit?: string | null;
    }[]
  | null;

type UserProfile = {
  restaurant_id: string | null;
};

type MenuClientProps = {
  saveError?: string;
};

type EditComponentRow = {
  componentId: string;
  componentType: "inventory" | "recipe";
  id: number;
  quantity: string;
  unit: string;
};

function getRelatedItem<T>(relatedItem: T | T[] | null) {
  if (Array.isArray(relatedItem)) {
    return relatedItem[0] ?? null;
  }

  return relatedItem;
}

function getRelatedName(relatedItem: RelatedInventoryItem | RelatedRecipe) {
  return getRelatedItem(relatedItem)?.name ?? null;
}

function getComponentCost(component: MenuItemComponent) {
  return (component.quantity ?? 0) * getComponentUnitCost(component);
}

function getComponentUnitCost(component: MenuItemComponent) {
  const inventoryItem = getRelatedItem(component.inventory_items);
  const recipe = getRelatedItem(component.recipes);

  return inventoryItem?.base_unit_cost ?? recipe?.cost_per_unit ?? 0;
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function MenuClient({ saveError }: MenuClientProps) {
  const router = useRouter();
  const [components, setComponents] = useState<MenuItemComponent[]>([]);
  const [editingComponents, setEditingComponents] = useState<EditComponentRow[]>(
    [],
  );
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [semiProducts, setSemiProducts] = useState<SemiProduct[]>([]);

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

    if (profileError) {
      console.error("Could not load user profile:", profileError);
      setErrors([profileError.message]);
      return null;
    }

    const userProfile = profile as UserProfile | null;

    if (!userProfile?.restaurant_id) {
      console.error("No profile restaurant_id found for user.", userProfile);
      setErrors(["No profile restaurant_id found for this user."]);
      return null;
    }

    return userProfile.restaurant_id;
  }, [router]);

  const loadMenuData = useCallback(
    async (isMounted = true) => {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();
      const restaurantId = await getRestaurantId();

      if (!restaurantId) {
        if (isMounted) setIsLoading(false);
        return;
      }

      const [
        menuItemResult,
        inventoryItemResult,
        semiProductResult,
        componentResult,
      ] = await Promise.all([
        supabase
          .from("menu_items")
          .select("id, name, selling_price, active")
          .eq("restaurant_id", restaurantId)
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("inventory_items")
          .select("id, name, base_unit, base_unit_cost")
          .eq("restaurant_id", restaurantId)
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("recipes")
          .select("id, name, cost_per_unit, yield_unit")
          .eq("restaurant_id", restaurantId)
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("menu_item_components")
          .select(
            `
              id,
              menu_item_id,
              inventory_item_id,
              recipe_id,
              quantity,
              unit,
              inventory_items (
                name,
                base_unit,
                base_unit_cost
              ),
              recipes (
                name,
                yield_unit,
                cost_per_unit
              )
            `,
          )
          .eq("restaurant_id", restaurantId)
          .order("id", { ascending: true }),
      ]);

      if (!isMounted) {
        return;
      }

      const nextErrors = [
        menuItemResult.error
          ? `Could not load menu items: ${menuItemResult.error.message}`
          : "",
        inventoryItemResult.error
          ? `Could not load inventory items: ${inventoryItemResult.error.message}`
          : "",
        semiProductResult.error
          ? `Could not load semi-products: ${semiProductResult.error.message}`
          : "",
        componentResult.error
          ? `Could not load menu components: ${componentResult.error.message}`
          : "",
      ].filter(Boolean);

      if (menuItemResult.error) {
        console.error("Could not load menu items:", menuItemResult.error);
      }

      if (inventoryItemResult.error) {
        console.error("Could not load inventory items:", inventoryItemResult.error);
      }

      if (semiProductResult.error) {
        console.error("Could not load semi-products:", semiProductResult.error);
      }

      if (componentResult.error) {
        console.error("Could not load menu components:", componentResult.error);
      }

      setErrors(nextErrors);
      setMenuItems((menuItemResult.data ?? []) as MenuItem[]);
      setInventoryItems((inventoryItemResult.data ?? []) as InventoryItem[]);
      setSemiProducts((semiProductResult.data ?? []) as SemiProduct[]);
      setComponents((componentResult.data ?? []) as MenuItemComponent[]);
      setIsLoading(false);
    },
    [getRestaurantId],
  );

  useEffect(() => {
    let isMounted = true;

    loadMenuData(isMounted);

    return () => {
      isMounted = false;
    };
  }, [loadMenuData]);

  function getComponentOption(row: EditComponentRow) {
    const options =
      row.componentType === "inventory" ? inventoryItems : semiProducts;

    return options.find((option) => String(option.id) === row.componentId);
  }

  function getComponentUnit(row: EditComponentRow) {
    const option = getComponentOption(row);

    return row.componentType === "inventory"
      ? (option as InventoryItem | undefined)?.base_unit ?? ""
      : (option as SemiProduct | undefined)?.yield_unit ?? "";
  }

  function getEditComponentUnitCost(row: EditComponentRow) {
    const option = getComponentOption(row);

    return row.componentType === "inventory"
      ? (option as InventoryItem | undefined)?.base_unit_cost ?? 0
      : (option as SemiProduct | undefined)?.cost_per_unit ?? 0;
  }

  function updateEditingComponent(id: number, changes: Partial<EditComponentRow>) {
    setEditingComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === id ? { ...component, ...changes } : component,
      ),
    );
  }

  function startEditingMenuItem(item: MenuItem, itemComponents: MenuItemComponent[]) {
    setEditingMenuItem(item);
    setEditingComponents(
      itemComponents.map((component) => ({
        componentId: component.inventory_item_id
          ? String(component.inventory_item_id)
          : component.recipe_id
            ? String(component.recipe_id)
            : "",
        componentType: component.inventory_item_id ? "inventory" : "recipe",
        id: component.id,
        quantity: component.quantity === null ? "" : String(component.quantity),
        unit: component.unit ?? "",
      })),
    );
  }

  const editingTheoreticalCost = useMemo(
    () =>
      editingComponents.reduce(
        (sum, component) =>
          sum +
          (Number(component.quantity) || 0) *
            getEditComponentUnitCost(component),
        0,
      ),
    [editingComponents, inventoryItems, semiProducts],
  );

  async function handleUpdateMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingMenuItem) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const sellingPrice = Number(formData.get("selling_price"));
    const validComponents = editingComponents
      .map((component) => ({
        inventory_item_id:
          component.componentType === "inventory"
            ? Number(component.componentId)
            : null,
        menu_item_id: editingMenuItem.id,
        quantity: Number(component.quantity) || 0,
        recipe_id:
          component.componentType === "recipe" ? Number(component.componentId) : null,
        unit: component.unit || getComponentUnit(component),
      }))
      .filter((component) => component.inventory_item_id || component.recipe_id);

    if (!name || !sellingPrice) {
      setErrors(["Name and selling price are required."]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error: itemError } = await supabase
      .from("menu_items")
      .update({
        name,
        selling_price: sellingPrice,
      })
      .eq("id", editingMenuItem.id)
      .eq("restaurant_id", restaurantId);

    if (itemError) {
      console.error("Could not update menu item:", itemError);
      setErrors([itemError.message]);
      return;
    }

    const { error: deleteComponentsError } = await supabase
      .from("menu_item_components")
      .delete()
      .eq("menu_item_id", editingMenuItem.id)
      .eq("restaurant_id", restaurantId);

    if (deleteComponentsError) {
      console.error("Could not update menu item components:", deleteComponentsError);
      setErrors([deleteComponentsError.message]);
      return;
    }

    if (validComponents.length > 0) {
      const { error: insertComponentsError } = await supabase
        .from("menu_item_components")
        .insert(
          validComponents.map((component) => ({
            ...component,
            restaurant_id: restaurantId,
          })),
        );

      if (insertComponentsError) {
        console.error("Could not save menu item components:", insertComponentsError);
        setErrors([insertComponentsError.message]);
        return;
      }
    }

    setEditingMenuItem(null);
    setEditingComponents([]);
    await loadMenuData();
  }

  async function handleDeleteMenuItem(item: MenuItem) {
    const confirmed = window.confirm(
      `Deactivate menu item "${item.name ?? `Menu item ${item.id}`}"? Sales history will stay connected.`,
    );

    if (!confirmed) return;

    const supabase = getSupabaseBrowserClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) return;

    const { error: deactivateError } = await supabase
      .from("menu_items")
      .update({ active: false })
      .eq("id", item.id)
      .eq("restaurant_id", restaurantId);

    if (deactivateError) {
      console.error("Could not deactivate menu item:", deactivateError);
      setErrors([deactivateError.message]);
      return;
    }

    if (editingMenuItem?.id === item.id) {
      setEditingMenuItem(null);
      setEditingComponents([]);
    }

    await loadMenuData();
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Menu</h1>
          <p>Finished dish builder will be here.</p>
        </div>
      </div>

      {isLoading ? <div className="empty-state">Loading menu...</div> : null}

      {errors.length > 0 ? (
        <div className="error-state">
          <strong>Could not load menu data.</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <div className="error-state">
          <strong>Could not save menu item.</strong>
          <p>{saveError}</p>
        </div>
      ) : null}

      {!isLoading ? <MenuForm /> : null}

      {menuItems.length === 0 && !isLoading && errors.length === 0 ? (
        <div className="empty-state">No menu items yet.</div>
      ) : null}

      <div className="invoice-list">
        {menuItems.map((item) => {
          const itemComponents = components.filter(
            (component) => component.menu_item_id === item.id,
          );
          const theoreticalCost = itemComponents.reduce(
            (sum, component) => sum + getComponentCost(component),
            0,
          );
          const foodCostPercent = item.selling_price
            ? (theoreticalCost / item.selling_price) * 100
            : null;
          const grossProfit =
            item.selling_price === null || item.selling_price === undefined
              ? null
              : item.selling_price - theoreticalCost;
          const grossMargin =
            item.selling_price && grossProfit !== null
              ? (grossProfit / item.selling_price) * 100
              : null;

          return (
            <section className="invoice-card" key={item.id}>
              <div className="invoice-summary">
                <div>
                  <span className="label">Menu item</span>
                  <span className="value">{item.name ?? "-"}</span>
                </div>
                <div>
                  <span className="label">Selling price</span>
                  <span className="value">{formatAmount(item.selling_price)}</span>
                </div>
                <div>
                  <span className="label">Active</span>
                  <span className="value">{item.active ? "Yes" : "No"}</span>
                </div>
                <div>
                  <span className="label">Theoretical cost</span>
                  <span className="value">
                    {formatAmount(theoreticalCost)}
                  </span>
                </div>
                <div>
                  <span className="label">Food Cost %</span>
                  <span className="value">
                    {foodCostPercent === null
                      ? "-"
                      : `${formatAmount(foodCostPercent)} %`}
                  </span>
                </div>
                <div>
                  <span className="label">Gross profit</span>
                  <span className="value">
                    {formatAmount(grossProfit)}
                  </span>
                </div>
                <div>
                  <span className="label">Gross margin %</span>
                  <span className="value">
                    {grossMargin === null ? "-" : `${formatAmount(grossMargin)} %`}
                  </span>
                </div>
                <div>
                  <span className="label">Actions</span>
                  <span className="value">
                    <button
                      className="button secondary"
                      onClick={() => startEditingMenuItem(item, itemComponents)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => handleDeleteMenuItem(item)}
                      type="button"
                    >
                      Deactivate
                    </button>
                  </span>
                </div>
              </div>

              {editingMenuItem?.id === item.id ? (
                <form className="form-card recipe-form" onSubmit={handleUpdateMenuItem}>
                  <label>
                    Menu item name
                    <input
                      defaultValue={item.name ?? ""}
                      name="name"
                      required
                      type="text"
                    />
                  </label>

                  <label>
                    Selling price
                    <input
                      defaultValue={item.selling_price ?? ""}
                      min="0"
                      name="selling_price"
                      required
                      step="0.01"
                      type="number"
                    />
                  </label>

                  <div className="form-section">
                    <div className="form-section-header">
                      <h2>Components</h2>
                      <button
                        className="button secondary"
                        onClick={() =>
                          setEditingComponents((currentComponents) => [
                            ...currentComponents,
                            {
                              componentId: "",
                              componentType: "inventory",
                              id: Date.now(),
                              quantity: "",
                              unit: "",
                            },
                          ])
                        }
                        type="button"
                      >
                        Add component
                      </button>
                    </div>

                    <div className="item-list">
                      {editingComponents.map((component) => {
                        const options =
                          component.componentType === "inventory"
                            ? inventoryItems
                            : semiProducts;
                        const unitCost = getEditComponentUnitCost(component);
                        const lineCost =
                          (Number(component.quantity) || 0) * unitCost;

                        return (
                          <div className="recipe-item-row" key={component.id}>
                            <label>
                              Component type
                              <select
                                onChange={(event) =>
                                  updateEditingComponent(component.id, {
                                    componentId: "",
                                    componentType: event.target.value as
                                      | "inventory"
                                      | "recipe",
                                    unit: "",
                                  })
                                }
                                value={component.componentType}
                              >
                                <option value="inventory">Inventory item</option>
                                <option value="recipe">Semi-product</option>
                              </select>
                            </label>

                            <label>
                              Component
                              <select
                                onChange={(event) => {
                                  const nextComponent = {
                                    ...component,
                                    componentId: event.target.value,
                                  };

                                  updateEditingComponent(component.id, {
                                    componentId: event.target.value,
                                    unit: getComponentUnit(nextComponent),
                                  });
                                }}
                                required
                                value={component.componentId}
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
                                onChange={(event) =>
                                  updateEditingComponent(component.id, {
                                    quantity: event.target.value,
                                  })
                                }
                                required
                                step="0.01"
                                type="number"
                                value={component.quantity}
                              />
                            </label>

                            <div>
                              <span className="label">Unit</span>
                              <span>{component.unit || getComponentUnit(component) || "-"}</span>
                            </div>

                            <div>
                              <span className="label">Unit cost</span>
                              <span>{formatAmount(unitCost)}</span>
                            </div>

                            <div>
                              <span className="label">Line cost</span>
                              <span>{formatAmount(lineCost)}</span>
                            </div>

                            <button
                              className="button secondary"
                              onClick={() =>
                                setEditingComponents((currentComponents) =>
                                  currentComponents.filter(
                                    (currentComponent) =>
                                      currentComponent.id !== component.id,
                                  ),
                                )
                              }
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="label">Theoretical cost</span>
                    <span className="form-total">
                      {formatAmount(editingTheoreticalCost)}
                    </span>
                  </div>

                  <button className="button" type="submit">
                    Save changes
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditingMenuItem(null);
                      setEditingComponents([]);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </form>
              ) : null}

              <div className="form-section">
                <div className="form-section-header">
                  <h2>Add component</h2>
                </div>
                <MenuComponentForm
                  inventoryItems={inventoryItems}
                  menuItemId={item.id}
                  semiProducts={semiProducts}
                />
              </div>

              {itemComponents.length > 0 ? (
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Name</th>
                      <th className="number">Quantity</th>
                      <th>Unit</th>
                      <th className="number">Unit cost</th>
                      <th className="number">Line cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemComponents.map((component) => {
                      const isInventory = Boolean(component.inventory_item_id);
                      const unitCost = getComponentUnitCost(component);
                      const lineCost = getComponentCost(component);

                      return (
                        <tr key={component.id}>
                          <td>
                            {isInventory ? "Inventory item" : "Semi-product"}
                          </td>
                          <td>
                            {getRelatedName(component.inventory_items) ??
                              getRelatedName(component.recipes) ??
                              "-"}
                          </td>
                          <td className="number">
                            {formatAmount(component.quantity)}
                          </td>
                          <td>{component.unit ?? "-"}</td>
                          <td className="number">{formatAmount(unitCost)}</td>
                          <td className="number">{formatAmount(lineCost)}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td colSpan={5}>
                        <strong>Total</strong>
                      </td>
                      <td className="number">
                        <strong>{formatAmount(theoreticalCost)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="muted">No components yet.</p>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
