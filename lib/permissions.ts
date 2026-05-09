export type UserRole =
  | "owner"
  | "admin"
  | "general_manager"
  | "manager"
  | "chef"
  | "sous_chef"
  | "bar_manager"
  | "assistant_bar_manager"
  | "front_manager"
  | "employee";

export type AppModule =
  | "dashboard"
  | "invoices"
  | "sales"
  | "inventory"
  | "employees"
  | "schedule"
  | "food"
  | "recipes"
  | "menu"
  | "food_cost"
  | "waste"
  | "beverage"
  | "bar_inventory"
  | "bar_labor"
  | "bar_cost"
  | "front"
  | "department_labor"
  | "kpi"
  | "budget"
  | "settings"
  | "billing"
  | "user_roles"
  | "own_profile"
  | "own_schedule"
  | "own_documents";

const roles: UserRole[] = [
  "owner",
  "admin",
  "general_manager",
  "manager",
  "chef",
  "sous_chef",
  "bar_manager",
  "assistant_bar_manager",
  "front_manager",
  "employee",
];

const operationalModules: AppModule[] = [
  "dashboard",
  "invoices",
  "sales",
  "inventory",
  "employees",
  "schedule",
  "food",
  "recipes",
  "menu",
  "food_cost",
  "waste",
  "beverage",
  "bar_inventory",
  "bar_labor",
  "bar_cost",
  "front",
  "department_labor",
  "kpi",
  "budget",
];

const accessByRole: Record<UserRole, AppModule[]> = {
  owner: [
    ...operationalModules,
    "settings",
    "billing",
    "user_roles",
    "own_profile",
    "own_schedule",
    "own_documents",
  ],
  admin: [
    ...operationalModules,
    "settings",
    "billing",
    "user_roles",
    "own_profile",
    "own_schedule",
    "own_documents",
  ],
  general_manager: [
    ...operationalModules,
    "own_profile",
    "own_schedule",
    "own_documents",
  ],
  manager: [
    "dashboard",
    "invoices",
    "sales",
    "inventory",
    "employees",
    "schedule",
    "food",
    "recipes",
    "menu",
    "food_cost",
    "department_labor",
    "kpi",
    "budget",
    "own_profile",
    "own_schedule",
    "own_documents",
  ],
  chef: [
    "dashboard",
    "food",
    "inventory",
    "recipes",
    "menu",
    "food_cost",
    "department_labor",
    "own_profile",
    "own_schedule",
    "own_documents",
  ],
  sous_chef: [
    "food",
    "inventory",
    "recipes",
    "waste",
    "food_cost",
    "own_profile",
    "own_schedule",
    "own_documents",
  ],
  bar_manager: [
    "dashboard",
    "sales",
    "beverage",
    "bar_inventory",
    "bar_labor",
    "bar_cost",
    "department_labor",
    "own_profile",
    "own_schedule",
    "own_documents",
  ],
  assistant_bar_manager: [
    "beverage",
    "bar_inventory",
    "own_profile",
    "own_schedule",
    "own_documents",
  ],
  front_manager: [
    "dashboard",
    "sales",
    "front",
    "employees",
    "schedule",
    "own_profile",
    "own_schedule",
    "own_documents",
  ],
  employee: ["own_profile", "own_schedule", "own_documents"],
};

const editByRole: Record<UserRole, AppModule[]> = {
  owner: accessByRole.owner,
  admin: accessByRole.admin,
  general_manager: operationalModules,
  manager: ["invoices", "sales", "inventory", "employees", "schedule", "food"],
  chef: ["food", "inventory", "recipes", "menu"],
  sous_chef: ["inventory", "recipes", "waste"],
  bar_manager: ["sales", "beverage", "bar_inventory", "bar_labor"],
  assistant_bar_manager: ["bar_inventory"],
  front_manager: ["sales", "front", "employees", "schedule"],
  employee: [],
};

export function normalizeRole(role: unknown): UserRole {
  if (typeof role !== "string") return "employee";

  const normalizedRole = role.trim().toLowerCase() as UserRole;

  return roles.includes(normalizedRole) ? normalizedRole : "employee";
}

export function canAccessModule(role: unknown, module: AppModule) {
  const normalizedRole = normalizeRole(role);

  return accessByRole[normalizedRole].includes(module);
}

export function canEditModule(role: unknown, module: AppModule) {
  const normalizedRole = normalizeRole(role);

  return editByRole[normalizedRole].includes(module);
}

export function getModuleForPath(pathname: string): AppModule | null {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/invoices") || pathname.startsWith("/suppliers")) {
    return "invoices";
  }
  if (pathname.startsWith("/sales")) return "sales";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/recipes")) return "recipes";
  if (pathname.startsWith("/menu")) return "menu";
  if (pathname.startsWith("/food/cost")) return "food_cost";
  if (pathname.startsWith("/food/real-cost")) return "food_cost";
  if (pathname.startsWith("/food")) return "food";
  if (pathname.startsWith("/bar/inventory")) return "bar_inventory";
  if (pathname.startsWith("/bar/cost")) return "bar_cost";
  if (pathname.startsWith("/bar/real-cost")) return "bar_cost";
  if (pathname.startsWith("/bar/bar-employees")) return "bar_labor";
  if (pathname.startsWith("/bar")) return "beverage";
  if (pathname.startsWith("/employees")) return "employees";
  if (pathname.startsWith("/schedule")) return "schedule";
  if (pathname.startsWith("/department/labor-cost")) return "department_labor";
  if (pathname.startsWith("/kpi")) return "kpi";
  if (pathname.startsWith("/budget")) return "budget";

  return null;
}
