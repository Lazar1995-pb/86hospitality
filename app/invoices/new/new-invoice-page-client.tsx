"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NewInvoiceForm } from "./new-invoice-form";

type Supplier = {
  id: number;
  name: string | null;
  company_name: string | null;
};

type CostCategory = {
  id: number;
  name: string | null;
};

type CostSubcategory = {
  id: number;
  name: string | null;
  cost_category_id: number | null;
};

type UserProfile = {
  restaurant_id: number | null;
};

type NewInvoicePageClientProps = {
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

function dedupeSubcategories(items: CostSubcategory[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.cost_category_id}:${(item.name ?? "").trim().toLowerCase()}`;
    if (!item.name || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export function NewInvoicePageClient({ saveError }: NewInvoicePageClientProps) {
  const router = useRouter();
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);
  const [costSubcategories, setCostSubcategories] = useState<CostSubcategory[]>(
    [],
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadDropdownData() {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.log("Could not load authenticated user:", userError.message);
        if (isMounted) {
          setErrors([userError.message]);
          setIsLoading(false);
        }
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("restaurant_id")
        .eq("auth_user_id", user.id)
        .single();

      const restaurantId = (profile as UserProfile | null)?.restaurant_id;

      if (profileError || !restaurantId) {
        console.error("Could not load user profile:", profileError);
        if (isMounted) {
          setErrors(["No restaurant profile found."]);
          setIsLoading(false);
        }
        return;
      }

      const [supplierResult, categoryResult, subcategoryResult] =
        await Promise.all([
          supabase
            .from("suppliers")
            .select("id, name, company_name")
            .eq("restaurant_id", restaurantId)
            .order("name", { ascending: true }),
          supabase
            .from("cost_categories")
            .select("id, name")
            .eq("restaurant_id", restaurantId)
            .order("name", { ascending: true }),
          supabase
            .from("cost_subcategories")
            .select("id, name, cost_category_id")
            .eq("restaurant_id", restaurantId)
            .order("name", { ascending: true }),
        ]);

      if (!isMounted) {
        return;
      }

      const nextErrors = [
        supplierResult.error
          ? `Could not load suppliers: ${supplierResult.error.message}`
          : "",
        categoryResult.error
          ? `Could not load KPI categories: ${categoryResult.error.message}`
          : "",
        subcategoryResult.error
          ? `Could not load cost subcategories: ${subcategoryResult.error.message}`
          : "",
      ].filter(Boolean);

      nextErrors.forEach((error) => console.log(error));

      setErrors(nextErrors);
      setSuppliers(dedupeByName((supplierResult.data ?? []) as Supplier[]));
      setCostCategories(
        dedupeByName((categoryResult.data ?? []) as CostCategory[]),
      );
      setCostSubcategories(
        dedupeSubcategories(
          (subcategoryResult.data ?? []) as CostSubcategory[],
        ),
      );
      setIsLoading(false);
    }

    loadDropdownData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>New invoice</h1>
          <p>Add a simple purchase invoice.</p>
        </div>
        <Link className="button secondary" href="/invoices">
          Back
        </Link>
      </div>

      {isLoading ? (
        <div className="empty-state">Loading invoice dropdowns...</div>
      ) : null}

      {errors.length > 0 ? (
        <div className="error-state">
          <strong>Could not load invoice dropdowns.</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <div className="error-state">
          <strong>Could not save invoice.</strong>
          <p>{saveError}</p>
        </div>
      ) : null}

      {!isLoading ? (
        <NewInvoiceForm
          costCategories={costCategories}
          costSubcategories={costSubcategories}
          suppliers={suppliers}
        />
      ) : null}
    </main>
  );
}
