"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type SidebarLink = {
  href: string;
  label: string;
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
  user_id: string | null;
};

type Restaurant = {
  id?: string | null;
  name: string | null;
};

const groups: SidebarGroup[] = [
  {
    links: [{ href: "/", label: "Dashboard" }],
  },
  {
    label: "Invoices",
    links: [
      { href: "/invoices", label: "Invoice list" },
      { href: "/invoices/new", label: "New invoice" },
      { href: "/suppliers", label: "Suppliers" },
    ],
  },
  {
    links: [{ href: "/sales", label: "Sales" }],
  },
  {
    label: "Food",
    links: [
      { href: "/inventory", label: "Inventory" },
      { href: "/recipes", label: "Semi-products" },
      { href: "/menu", label: "Menu" },
      { href: "/food/cost", label: "Food Cost" },
      { href: "/food/real-cost", label: "Real Food Cost" },
    ],
  },
  {
    label: "Beverage",
    links: [
      { href: "/bar/inventory", label: "Inventory" },
      { href: "/recipes?department=beverage", label: "Semi-products" },
      { href: "/bar/menu", label: "Menu" },
      { href: "/bar/cost", label: "Beverage Cost" },
      { href: "/bar/real-cost", label: "Real Beverage Cost" },
    ],
  },
  {
    label: "Department",
    links: [
      { href: "/employees", label: "Employees" },
      { href: "/schedule", label: "Schedule" },
    ],
  },
  {
    label: "KPI",
    links: [
      { href: "/kpi", label: "Dashboard" },
      { href: "/budget", label: "Budget" },
    ],
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
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("users_profiles")
        .select("id, user_id, restaurant_id, created_at, auth_user_id")
        .eq("auth_user_id", user.id)
        .limit(1);

      if (profileError) {
        console.error("Could not load sidebar user profile:", profileError.message);
      }

      const profile = (profiles?.[0] ?? null) as SidebarProfile | null;
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

  return (
    <aside className="sidebar">
      <div className="sidebar-title">MVP</div>
      <nav className="sidebar-nav">
        {groups.map((group, index) => {
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
