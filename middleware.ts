import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessModule, getModuleForPath } from "./lib/permissions";

const protectedPrefixes = [
  "/bar",
  "/budget",
  "/department",
  "/employees",
  "/food",
  "/inventory",
  "/invoices",
  "/kpi",
  "/menu",
  "/recipes",
  "/sales",
  "/schedule",
  "/settings",
  "/suppliers",
];

function isProtectedPath(pathname: string) {
  if (pathname === "/") return true;

  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set(
      "redirectedFrom",
      `${pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(redirectUrl);
  }

  if (user && isProtectedPath(pathname)) {
    const module = getModuleForPath(pathname);

    if (module) {
      const { data: profiles, error: profileError } = await supabase
        .from("users_profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .limit(1);
      const profile = (profiles?.[0] ?? null) as { role?: string | null } | null;

      if (profileError) {
        console.error("Could not load profile for permissions:", profileError.message);
      }

      if (!canAccessModule(profile?.role, module)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/access-denied";
        redirectUrl.searchParams.set("module", module);

        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  if (user && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/invoices";
    redirectUrl.search = "";

    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
