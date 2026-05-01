"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RecipeForm } from "./recipe-form";

type InventoryItem = {
  id: number;
  name: string | null;
  base_unit: string | null;
  base_unit_cost: number | null;
};

type RecipeItem = {
  id: number;
  inventory_item_id: number | null;
  quantity: number | null;
  unit: string | null;
  inventory_items: RelatedInventoryItem;
};

type RelatedInventoryItem =
  | {
      name: string | null;
      base_unit_cost: number | null;
    }
  | {
      name: string | null;
      base_unit_cost: number | null;
    }[]
  | null;

type Recipe = {
  id: number;
  name: string | null;
  active: boolean | null;
  total_cost: number | null;
  yield_quantity: number | null;
  yield_unit: string | null;
  cost_per_unit: number | null;
  recipe_items: RecipeItem[];
};

type UserProfile = {
  restaurant_id: string | null;
};

type RecipesClientProps = {
  saveError?: string;
};

type EditIngredientRow = {
  id: number;
  inventoryItemId: string;
  quantity: string;
  unit: string;
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function getRelatedInventoryItem(item: RelatedInventoryItem) {
  if (Array.isArray(item)) {
    return item[0] ?? null;
  }

  return item;
}

function getRecipeCost(recipe: Recipe) {
  return (recipe.recipe_items ?? []).reduce(
    (sum, item) => {
      const inventoryItem = getRelatedInventoryItem(item.inventory_items);

      return sum + (item.quantity ?? 0) * (inventoryItem?.base_unit_cost ?? 0);
    },
    0,
  );
}

export function RecipesClient({ saveError }: RecipesClientProps) {
  const router = useRouter();
  const [editingIngredients, setEditingIngredients] = useState<EditIngredientRow[]>(
    [],
  );
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editingYieldQuantity, setEditingYieldQuantity] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const getRestaurantId = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Could not load authenticated user:", userError.message);
      setErrors([userError.message]);
      return null;
    }

    if (!user) {
      router.replace("/login");
      return null;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("users_profiles")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .limit(1);

    if (profileError) {
      console.error("Could not load user profile:", profileError.message);
      setErrors([profileError.message]);
      return null;
    }

    const profile = (profiles?.[0] ?? null) as UserProfile | null;

    if (!profile?.restaurant_id) {
      console.error("No profile restaurant_id found for user.", profile);
      setErrors(["No profile restaurant_id found for this user."]);
      return null;
    }

    return profile.restaurant_id;
  }, [router]);

  const loadRecipes = useCallback(
    async (isMounted = true) => {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();
      const nextRestaurantId = await getRestaurantId();

      if (!nextRestaurantId) {
        if (isMounted) setIsLoading(false);
        return;
      }

      setRestaurantId(nextRestaurantId);

      const [inventoryResult, recipeResult] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("id, name, base_unit, base_unit_cost")
          .eq("restaurant_id", nextRestaurantId)
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("recipes")
          .select(
            `
              id,
              name,
              active,
              total_cost,
              yield_quantity,
              yield_unit,
              cost_per_unit,
              recipe_items (
                id,
                inventory_item_id,
                quantity,
                unit,
                inventory_items (
                  name,
                  base_unit_cost
                )
              )
            `,
          )
          .eq("restaurant_id", nextRestaurantId)
          .order("name", { ascending: true }),
      ]);

      if (!isMounted) {
        return;
      }

      const nextErrors = [
        inventoryResult.error
          ? `Could not load inventory items: ${inventoryResult.error.message}`
          : "",
        recipeResult.error
          ? `Could not load recipes: ${recipeResult.error.message}`
          : "",
      ].filter(Boolean);

      if (inventoryResult.error) {
        console.error("Could not load inventory items:", inventoryResult.error);
      }

      if (recipeResult.error) {
        console.error("Could not load recipes:", recipeResult.error);
      }

      setErrors(nextErrors);
      setInventoryItems(
        dedupeByName((inventoryResult.data ?? []) as InventoryItem[]),
      );
      setRecipes((recipeResult.data ?? []) as Recipe[]);
      setIsLoading(false);
    },
    [getRestaurantId],
  );

  useEffect(() => {
    let isMounted = true;

    loadRecipes(isMounted);

    return () => {
      isMounted = false;
    };
  }, [loadRecipes]);

  function getInventoryItem(inventoryItemId: string) {
    return inventoryItems.find((item) => String(item.id) === inventoryItemId);
  }

  function updateEditingIngredient(
    id: number,
    changes: Partial<EditIngredientRow>,
  ) {
    setEditingIngredients((currentIngredients) =>
      currentIngredients.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, ...changes } : ingredient,
      ),
    );
  }

  function startEditingRecipe(recipe: Recipe) {
    setEditingRecipe(recipe);
    setEditingYieldQuantity(String(recipe.yield_quantity ?? ""));
    setEditingIngredients(
      (recipe.recipe_items ?? []).map((item) => ({
        id: item.id,
        inventoryItemId: item.inventory_item_id
          ? String(item.inventory_item_id)
          : "",
        quantity: item.quantity === null ? "" : String(item.quantity),
        unit: item.unit ?? "",
      })),
    );
  }

  const editingTotalBatchCost = useMemo(
    () =>
      editingIngredients.reduce((sum, ingredient) => {
        const inventoryItem = getInventoryItem(ingredient.inventoryItemId);

        return (
          sum +
          (Number(ingredient.quantity) || 0) *
            (inventoryItem?.base_unit_cost ?? 0)
        );
      }, 0),
    [editingIngredients, inventoryItems],
  );
  const editingCostPerUnit =
    Number(editingYieldQuantity) > 0
      ? editingTotalBatchCost / Number(editingYieldQuantity)
      : 0;

  async function handleUpdateRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingRecipe) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const yieldQuantity = Number(formData.get("yield_quantity"));
    const yieldUnit = String(formData.get("yield_unit") ?? "").trim();
    const active = formData.get("active") === "on";
    const validIngredients = editingIngredients
      .map((ingredient) => ({
        inventory_item_id: Number(ingredient.inventoryItemId),
        quantity: Number(ingredient.quantity) || 0,
        recipe_id: editingRecipe.id,
        unit: ingredient.unit,
        waste_percent: 0,
      }))
      .filter((ingredient) => ingredient.inventory_item_id);

    if (!name || !yieldQuantity || !yieldUnit || validIngredients.length === 0) {
      setErrors([
        "Name, yield quantity, yield unit, and at least one ingredient are required.",
      ]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const nextRestaurantId = await getRestaurantId();

    if (!nextRestaurantId) return;

    const { error: recipeError } = await supabase
      .from("recipes")
      .update({
        active,
        cost_per_unit: editingCostPerUnit,
        name,
        total_cost: editingTotalBatchCost,
        yield_quantity: yieldQuantity,
        yield_unit: yieldUnit,
      })
      .eq("id", editingRecipe.id)
      .eq("restaurant_id", nextRestaurantId);

    if (recipeError) {
      console.error("Could not update recipe:", recipeError);
      setErrors([recipeError.message]);
      return;
    }

    const { error: deleteItemsError } = await supabase
      .from("recipe_items")
      .delete()
      .eq("recipe_id", editingRecipe.id);

    if (deleteItemsError) {
      console.error("Could not update recipe ingredients:", deleteItemsError);
      setErrors([deleteItemsError.message]);
      return;
    }

    const { error: insertItemsError } = await supabase
      .from("recipe_items")
      .insert(validIngredients);

    if (insertItemsError) {
      console.error("Could not save recipe ingredients:", insertItemsError);
      setErrors([insertItemsError.message]);
      return;
    }

    setEditingRecipe(null);
    setEditingIngredients([]);
    await loadRecipes();
  }

  async function handleDeleteRecipe(recipe: Recipe) {
    const confirmed = window.confirm(
      `Delete semi-product "${recipe.name ?? `Recipe ${recipe.id}`}"?`,
    );

    if (!confirmed) return;

    const supabase = getSupabaseBrowserClient();
    const nextRestaurantId = await getRestaurantId();

    if (!nextRestaurantId) return;

    const { error: deleteItemsError } = await supabase
      .from("recipe_items")
      .delete()
      .eq("recipe_id", recipe.id);

    if (deleteItemsError) {
      console.error("Could not delete recipe ingredients:", deleteItemsError);
      setErrors([deleteItemsError.message]);
      return;
    }

    const { error: deleteRecipeError } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipe.id)
      .eq("restaurant_id", nextRestaurantId);

    if (deleteRecipeError) {
      console.error("Could not delete recipe:", deleteRecipeError);
      setErrors([deleteRecipeError.message]);
      return;
    }

    if (editingRecipe?.id === recipe.id) {
      setEditingRecipe(null);
      setEditingIngredients([]);
    }

    await loadRecipes();
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Semi-products</h1>
          <p>Poluproizvodi made from inventory items.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state">Loading semi-products...</div>
      ) : null}

      {errors.length > 0 ? (
        <div className="error-state">
          <strong>Could not load semi-product data.</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <div className="error-state">
          <strong>Could not save recipe.</strong>
          <p>{saveError}</p>
        </div>
      ) : null}

      {!isLoading && restaurantId ? (
        <RecipeForm inventoryItems={inventoryItems} />
      ) : null}

      {recipes.length === 0 && !isLoading && errors.length === 0 ? (
        <div className="empty-state">No semi-products yet.</div>
      ) : null}

      <div className="invoice-list">
        {recipes.map((recipe) => {
          const recipeCost = getRecipeCost(recipe);
          const totalBatchCost = recipe.total_cost ?? recipeCost;

          return (
            <section className="invoice-card" key={recipe.id}>
              <div className="invoice-summary">
                <div>
                  <span className="label">Semi-product</span>
                  <span className="value">
                    {recipe.name ?? "Unnamed semi-product"}
                  </span>
                </div>
                <div>
                  <span className="label">Yield</span>
                  <span className="value">
                    {recipe.yield_quantity ?? "-"} {recipe.yield_unit ?? ""}
                  </span>
                </div>
                <div>
                  <span className="label">Batch cost</span>
                  <span className="value">{formatAmount(totalBatchCost)}</span>
                </div>
                <div>
                  <span className="label">Cost per unit</span>
                  <span className="value">{formatAmount(recipe.cost_per_unit)}</span>
                </div>
                <div>
                  <span className="label">Actions</span>
                  <span className="value">
                    <button
                      className="button secondary"
                      onClick={() => startEditingRecipe(recipe)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => handleDeleteRecipe(recipe)}
                      type="button"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </div>

              {editingRecipe?.id === recipe.id ? (
                <form className="form-card recipe-form" onSubmit={handleUpdateRecipe}>
                  <label>
                    Semi-product name
                    <input
                      defaultValue={recipe.name ?? ""}
                      name="name"
                      required
                      type="text"
                    />
                  </label>

                  <label>
                    Yield quantity
                    <input
                      min="0"
                      name="yield_quantity"
                      onChange={(event) =>
                        setEditingYieldQuantity(event.target.value)
                      }
                      required
                      step="0.01"
                      type="number"
                      value={editingYieldQuantity}
                    />
                  </label>

                  <label>
                    Yield unit
                    <select defaultValue={recipe.yield_unit ?? "g"} name="yield_unit" required>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="pcs">pcs</option>
                    </select>
                  </label>

                  <label className="checkbox-label">
                    <input defaultChecked={recipe.active ?? true} name="active" type="checkbox" />
                    Active
                  </label>

                  <div className="form-section">
                    <div className="form-section-header">
                      <h2>Ingredients</h2>
                      <button
                        className="button secondary"
                        onClick={() =>
                          setEditingIngredients((currentIngredients) => [
                            ...currentIngredients,
                            {
                              id: Date.now(),
                              inventoryItemId: "",
                              quantity: "",
                              unit: "",
                            },
                          ])
                        }
                        type="button"
                      >
                        Add ingredient
                      </button>
                    </div>

                    <div className="item-list">
                      {editingIngredients.map((ingredient) => {
                        const inventoryItem = getInventoryItem(
                          ingredient.inventoryItemId,
                        );
                        const lineCost =
                          (Number(ingredient.quantity) || 0) *
                          (inventoryItem?.base_unit_cost ?? 0);

                        return (
                          <div className="recipe-item-row" key={ingredient.id}>
                            <label>
                              Inventory item
                              <select
                                disabled={inventoryItems.length === 0}
                                onChange={(event) => {
                                  const selectedItem = getInventoryItem(
                                    event.target.value,
                                  );

                                  updateEditingIngredient(ingredient.id, {
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
                                onChange={(event) =>
                                  updateEditingIngredient(ingredient.id, {
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
                                onChange={(event) =>
                                  updateEditingIngredient(ingredient.id, {
                                    unit: event.target.value,
                                  })
                                }
                                required
                                type="text"
                                value={ingredient.unit}
                              />
                            </label>

                            <div>
                              <span className="label">Base unit cost</span>
                              <span>
                                {formatAmount(inventoryItem?.base_unit_cost ?? null)}
                              </span>
                            </div>

                            <div>
                              <span className="label">Line cost</span>
                              <span>{formatAmount(lineCost)}</span>
                            </div>

                            <button
                              className="button secondary"
                              onClick={() =>
                                setEditingIngredients((currentIngredients) =>
                                  currentIngredients.filter(
                                    (currentIngredient) =>
                                      currentIngredient.id !== ingredient.id,
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
                    <span className="label">Estimated batch cost</span>
                    <span className="form-total">
                      {formatAmount(editingTotalBatchCost)}
                    </span>
                  </div>

                  <div>
                    <span className="label">Cost per yield unit</span>
                    <span className="form-total">
                      {formatAmount(editingCostPerUnit)}
                    </span>
                  </div>

                  <button className="button" type="submit">
                    Save changes
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditingRecipe(null);
                      setEditingIngredients([]);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </form>
              ) : null}

              {(recipe.recipe_items ?? []).length > 0 ? (
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Inventory item</th>
                      <th className="number">Quantity</th>
                      <th>Unit</th>
                      <th className="number">Base unit cost</th>
                      <th className="number">Line cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recipe.recipe_items ?? []).map((item) => {
                      const inventoryItem = getRelatedInventoryItem(
                        item.inventory_items,
                      );
                      const lineCost =
                        (item.quantity ?? 0) * (inventoryItem?.base_unit_cost ?? 0);

                      return (
                        <tr key={item.id}>
                          <td>{inventoryItem?.name ?? "-"}</td>
                          <td className="number">
                            {formatAmount(item.quantity)}
                          </td>
                          <td>{item.unit ?? "-"}</td>
                          <td className="number">
                            {formatAmount(
                              inventoryItem?.base_unit_cost ?? null,
                            )}
                          </td>
                          <td className="number">{formatAmount(lineCost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="muted">No ingredients for this recipe.</p>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
