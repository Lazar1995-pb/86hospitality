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

  useEffect(() => {
    const activeGroups = getOpenGroupsForPath(currentHref, pathname);

    setOpenGroups((currentGroups) => ({
      ...currentGroups,
      ...activeGroups,
    }));
  }, [currentHref, pathname]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function loadSession() {
      const result = await supabase.auth.getSession();
      setIsLoggedIn(Boolean(result.data.session));
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setIsLoggedIn(Boolean(session));
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
                          isActive ? "sidebar-link active" : "sidebar-link"
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
      </nav>
      {isLoggedIn ? (
        <button className="sidebar-logout" onClick={handleLogout} type="button">
          Logout
        </button>
      ) : null}
    </aside>
  );
}
