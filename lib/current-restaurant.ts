import { redirect } from "next/navigation";
import { getSupabaseClient } from "./supabase";

type UserProfile = {
  restaurant_id: string | null;
};

export async function getCurrentUserRestaurantId() {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users_profiles")
    .select("restaurant_id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  let restaurantId = (profile as UserProfile | null)?.restaurant_id;

  if (profileError) {
    console.error("Could not load users_profiles by auth_user_id:", profileError);
  }

  if (!restaurantId) {
    const { data: fallbackProfile, error: fallbackProfileError } = await supabase
      .from("users_profiles")
      .select("restaurant_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (fallbackProfileError) {
      console.error(
        "Could not load users_profiles by user_id:",
        fallbackProfileError,
      );
    }

    restaurantId = (fallbackProfile as UserProfile | null)?.restaurant_id;
  }

  if (!restaurantId) {
    console.error("No restaurant profile found for current user.");
    throw new Error("No restaurant profile found for this user.");
  }

  return restaurantId;
}
