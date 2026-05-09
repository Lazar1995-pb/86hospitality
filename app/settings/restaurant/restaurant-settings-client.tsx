"use client";

import {
  type DashboardCurrency,
  dashboardCurrencies,
} from "@/lib/format-money";
import { canEditModule } from "@/lib/permissions";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type UserProfile = {
  restaurant_id: string | null;
  role?: string | null;
};

type Restaurant = {
  currency: DashboardCurrency | null;
  id: string;
  name: string | null;
};

function getMetadataRole(user: { app_metadata?: unknown; user_metadata?: unknown }) {
  const appMetadata = user.app_metadata as Record<string, unknown> | undefined;
  const userMetadata = user.user_metadata as Record<string, unknown> | undefined;
  const role = appMetadata?.role ?? userMetadata?.role;

  return typeof role === "string" ? role.toLowerCase() : "";
}

export function RestaurantSettingsClient() {
  const router = useRouter();
  const [canEdit, setCanEdit] = useState(false);
  const [currency, setCurrency] = useState<DashboardCurrency>("EUR");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [roleNote, setRoleNote] = useState("");

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Could not load settings user:", userError.message);
      setError(userError.message);
      setIsLoading(false);
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("users_profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .limit(1);

    if (profileError) {
      console.error("Could not load settings profile:", profileError.message);
      setError(profileError.message);
      setIsLoading(false);
      return;
    }

    const profile = (profiles?.[0] ?? null) as UserProfile | null;

    if (!profile?.restaurant_id) {
      setError("No restaurant profile found.");
      setIsLoading(false);
      return;
    }

    const role =
      typeof profile.role === "string"
        ? profile.role.toLowerCase()
        : getMetadataRole(user);
    const userCanEdit = canEditModule(role, "settings") || role === "admin";
    setCanEdit(userCanEdit);
    setRoleNote(
      userCanEdit
        ? ""
        : "Only owner or admin users can edit restaurant settings.",
    );

    const { data: restaurantData, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, name, currency")
      .eq("id", profile.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      console.error("Could not load restaurant settings:", restaurantError.message);
      setError(restaurantError.message);
      setIsLoading(false);
      return;
    }

    const nextRestaurant = restaurantData as Restaurant | null;
    setRestaurant(nextRestaurant);
    setRestaurantName(nextRestaurant?.name ?? "");

    if (
      nextRestaurant?.currency &&
      dashboardCurrencies.includes(nextRestaurant.currency)
    ) {
      setCurrency(nextRestaurant.currency);
    }

    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!restaurant || !canEdit) return;

    setIsSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from("restaurants")
      .update({
        currency,
        name: restaurantName.trim(),
      })
      .eq("id", restaurant.id);

    if (updateError) {
      console.error("Could not save restaurant settings:", updateError.message);
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    await loadSettings();
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Restaurant settings</h1>
          <p>Manage restaurant profile and default currency.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state">Loading restaurant settings...</div>
      ) : null}

      {error ? (
        <div className="error-state">
          <strong>Could not load restaurant settings.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {!isLoading && restaurant ? (
        <form className="form-card inventory-form" onSubmit={handleSave}>
          <h2>Restaurant settings</h2>

          {roleNote ? <p className="muted">{roleNote}</p> : null}

          <label>
            Restaurant name
            <input
              disabled={!canEdit}
              onChange={(event) => setRestaurantName(event.target.value)}
              type="text"
              value={restaurantName}
            />
          </label>

          <label>
            Default currency
            <select
              disabled={!canEdit}
              onChange={(event) =>
                setCurrency(event.target.value as DashboardCurrency)
              }
              value={currency}
            >
              {dashboardCurrencies.map((currencyOption) => (
                <option key={currencyOption} value={currencyOption}>
                  {currencyOption}
                </option>
              ))}
            </select>
          </label>

          {canEdit ? (
            <button className="button" disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save settings"}
            </button>
          ) : (
            <div className="empty-state">Restaurant settings are read-only.</div>
          )}
        </form>
      ) : null}
    </main>
  );
}
