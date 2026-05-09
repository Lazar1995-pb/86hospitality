"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { type AppModule, canAccessModule } from "@/lib/permissions";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type SidebarLink = {
  href: string;
  label: string;
  module: AppModule;
};

type SidebarGroup = {
  label?: string;
  links: SidebarLink[];
};

type SidebarUser = {
  initials: string;
  restaurantName: string;
  userName: string;
};

type SidebarProfile = {
  auth_user_id: string | null;
  created_at: string | null;
  id: number | string;
  restaurant_id: string | null;
  role?: string | null;
  user_id: string | null;
};

type Restaurant = {
  id?: string | null;
  name: string | null;
};

const groups: SidebarGroup[] = [
  {
    links: [{ href: "/", label: "Dashboard", module: "dashboard" }],
  },
  {
    label: "Invoices",
    links: [
      { href: "/invoices", label: "Invoice list", module: "invoices" },
      { href: "/invoices/new", label: "New invoice", module: "invoices" },
      { href: "/suppliers", label: "Suppliers", module: "invoices" },
    ],
  },
  {
    links: [{ href: "/sales", label: "Sales", module: "sales" }],
  },
  {
    label: "Food",
    links: [
      { href: "/inventory", label: "Inventory", module: "inventory" },
      { href: "/recipes", label: "Semi-products", module: "recipes" },
      { href: "/menu", label: "Menu", module: "menu" },
      { href: "/food/cost", label: "Food Cost", module: "food_cost" },
      { href: "/food/real-cost", label: "Real Food Cost", module: "food_cost" },
    ],
  },
  {
    label: "Beverage",
    links: [
      { href: "/bar/inventory", label: "Inventory", module: "bar_inventory" },
      { href: "/recipes?department=beverage", label: "Semi-products", module: "beverage" },
      { href: "/bar/menu", label: "Menu", module: "beverage" },
      { href: "/bar/cost", label: "Beverage Cost", module: "bar_cost" },
      { href: "/bar/real-cost", label: "Real Beverage Cost", module: "bar_cost" },
    ],
  },
  {
    label: "Department",
    links: [
      { href: "/employees", label: "Employees", module: "employees" },
      { href: "/schedule", label: "Schedule", module: "schedule" },
      { href: "/department/labor-cost", label: "Labor Cost", module: "department_labor" },
    ],
  },
  {
    label: "KPI",
    links: [
      { href: "/kpi", label: "Dashboard", module: "kpi" },
      { href: "/budget", label: "Budget", module: "budget" },
    ],
  },
  {
    links: [{ href: "/settings/restaurant", label: "Settings", module: "settings" }],
  },
];

function getPathFromHref(href: string) {
  return href.split("?")[0];
}

function isActiveLink(href: string, currentHref: string, pathname: string) {
  return href.includes("?") ? currentHref === href : pathname === href;
}

function getOpenGroupsForPath(currentHref: string, pathname: string) {
  return groups.reduce<Record<string, boolean>>((openGroups, group) => {
    if (!group.label) {
      return openGroups;
    }

    openGroups[group.label] = group.links.some(
      (link) =>
        isActiveLink(link.href, currentHref, pathname) ||
        pathname === getPathFromHref(link.href),
    );
    return openGroups;
  }, {});
}

function getInitials(name: string) {
  const displayName = name.includes("@") ? name.split("@")[0] : name;
  const words = displayName.trim().split(/[\s._-]+/).filter(Boolean);

  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const currentHref = queryString ? `${pathname}?${queryString}` : pathname;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    getOpenGroupsForPath(currentHref, pathname)
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [sidebarUser, setSidebarUser] = useState<SidebarUser>({
    initials: "U",
    restaurantName: "No restaurant",
    userName: "User",
  });

  useEffect(() => {
    const activeGroups = getOpenGroupsForPath(currentHref, pathname);

    setOpenGroups((currentGroups) => ({
      ...currentGroups,
      ...activeGroups,
    }));
  }, [currentHref, pathname]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function loadSidebarUser(session: Session | null) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData.user ?? session?.user ?? null;
      const userEmail = user?.email ?? "User";

      if (userError) {
        console.error("Could not load sidebar auth user:", userError.message);
      }

      if (!user) {
        setSidebarUser({
          initials: "U",
          restaurantName: "No restaurant",
          userName: "User",
        });
        setRole(null);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("users_profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .limit(1);

      if (profileError) {
        console.error("Could not load sidebar user profile:", profileError.message);
      }

      const profile = (profiles?.[0] ?? null) as SidebarProfile | null;
      setRole(profile?.role ?? null);
      let restaurantName = "No restaurant";

      if (profile?.restaurant_id) {
        const restaurantId = profile.restaurant_id.trim();
        const { data: restaurant, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id, name")
          .eq("id", restaurantId)
          .maybeSingle();

        if (restaurantError) {
          console.error(
            "Could not load sidebar restaurant:",
            restaurantError.message,
          );
        }

        if (typeof restaurant?.name === "string" && restaurant.name.trim()) {
          restaurantName = restaurant.name;
        }
      } else if (!profileError) {
        console.error("Could not load sidebar user profile: No profile found.");
      }

      setSidebarUser({
        initials: getInitials(userEmail),
        restaurantName,
        userName: userEmail,
      });
    }

    async function loadSession() {
      const result = await supabase.auth.getSession();
      const session = result.data.session;

      setIsLoggedIn(Boolean(session));
      await loadSidebarUser(session);
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setIsLoggedIn(Boolean(session));
        void loadSidebarUser(session);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();

    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => canAccessModule(role, link.module)),
    }))
    .filter((group) => group.links.length > 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-title">MVP</div>
      <nav className="sidebar-nav">
        {visibleGroups.map((group, index) => {
          const groupKey = group.label ?? `main-${index}`;
          const isStandalone = !group.label;
          const isGroupOpen = isStandalone || openGroups[groupKey];

          return (
            <div className="sidebar-group" key={groupKey}>
              {group.label ? (
                <button
                  className="sidebar-group-button"
                  onClick={() =>
                    setOpenGroups((currentGroups) => ({
                      ...currentGroups,
                      [groupKey]: !currentGroups[groupKey],
                    }))
                  }
                  type="button"
                >
                  {group.label}
                  <span>{openGroups[groupKey] ? "v" : ">"}</span>
                </button>
              ) : null}
              {!isGroupOpen
                ? null
                : group.links.map((link) => {
                    const isActive = isActiveLink(
                      link.href,
                      currentHref,
                      pathname,
                    );

                    return (
                      <Link
                        className={
                          isStandalone && isActive
                            ? "sidebar-link sidebar-main-link active"
                            : isStandalone
                              ? "sidebar-link sidebar-main-link"
                              : isActive
                                ? "sidebar-link active"
                                : "sidebar-link"
                        }
                        href={link.href}
                        key={link.href}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
            </div>
          );
        })}
        {isLoggedIn ? (
          <button
            className="sidebar-link sidebar-main-link sidebar-logout"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
        ) : null}
      </nav>
      <div className="sidebar-footer">
        <div>
          <div className="sidebar-restaurant">{sidebarUser.restaurantName}</div>
          <div className="sidebar-user-name">{sidebarUser.userName}</div>
        </div>
        <div className="sidebar-avatar" aria-hidden="true">
          {sidebarUser.initials}
        </div>
      </div>
    </aside>
  );
}
