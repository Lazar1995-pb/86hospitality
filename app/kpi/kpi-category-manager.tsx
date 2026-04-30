"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type CostCategory = {
  id: number;
  name: string | null;
};

type UserProfile = {
  restaurant_id: number | null;
};

type KpiCategoryManagerProps = {
  categories: CostCategory[];
};

export function KpiCategoryManager({ categories }: KpiCategoryManagerProps) {
  const router = useRouter();
  const [editingCategory, setEditingCategory] = useState<CostCategory | null>(
    null,
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function getRestaurantId() {
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
  }

  async function handleRenameCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!editingCategory) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("category_name") ?? "").trim();

    if (!name) {
      setError("Category name is required.");
      return;
    }

    const restaurantId = await getRestaurantId();
    if (!restaurantId) return;

    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from("cost_categories")
      .update({ name })
      .eq("id", editingCategory.id)
      .eq("restaurant_id", restaurantId);

    if (updateError) {
      console.error("Could not rename KPI category:", updateError);
      setError(updateError.message);
      return;
    }

    setEditingCategory(null);
    setMessage("KPI category updated.");
    router.refresh();
  }

  async function handleDeleteCategory(category: CostCategory) {
    setError("");
    setMessage("");

    const confirmed = window.confirm(
      `Delete KPI category "${category.name ?? `Category ${category.id}`}"?`,
    );

    if (!confirmed) return;

    const restaurantId = await getRestaurantId();
    if (!restaurantId) return;

    const supabase = getSupabaseBrowserClient();
    const { count, error: usageError } = await supabase
      .from("invoice_items")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("cost_category_id", category.id);

    if (usageError) {
      console.error("Could not check KPI category usage:", usageError);
      setError(usageError.message);
      return;
    }

    if ((count ?? 0) > 0) {
      window.alert(
        "This KPI category is used in invoice items and cannot be deleted.",
      );
      return;
    }

    const { error: deleteError } = await supabase
      .from("cost_categories")
      .delete()
      .eq("id", category.id)
      .eq("restaurant_id", restaurantId);

    if (deleteError) {
      console.error("Could not delete KPI category:", deleteError);
      setError(deleteError.message);
      return;
    }

    if (editingCategory?.id === category.id) {
      setEditingCategory(null);
    }

    setMessage("KPI category deleted.");
    router.refresh();
  }

  return (
    <section className="dashboard-section">
      <h2>KPI categories</h2>

      {error ? (
        <div className="error-state">
          <strong>Could not update KPI category.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {message ? <div className="empty-state">{message}</div> : null}

      {editingCategory ? (
        <form className="form-card kpi-filters" onSubmit={handleRenameCategory}>
          <label>
            Category name
            <input
              defaultValue={editingCategory.name ?? ""}
              name="category_name"
              required
              type="text"
            />
          </label>

          <button className="button" type="submit">
            Save category
          </button>
          <button
            className="button secondary"
            onClick={() => setEditingCategory(null)}
            type="button"
          >
            Cancel
          </button>
        </form>
      ) : null}

      {categories.length > 0 ? (
        <table className="items-table inventory-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>{category.name ?? `Category ${category.id}`}</td>
                <td>
                  <button
                    className="button secondary"
                    onClick={() => setEditingCategory(category)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => handleDeleteCategory(category)}
                    type="button"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty-state">No KPI categories yet.</div>
      )}
    </section>
  );
}
