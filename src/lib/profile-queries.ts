/**
 * Secure profile query helpers
 *
 * Uses get_public_profiles RPC / public browsable views to fetch other users'
 * profiles without exposing sensitive fields (email, phone, coordinates, DOB).
 *
 * IMPORTANT: `profiles` RLS only allows owner/admin SELECT. Matching, discovery,
 * and online-user screens MUST use these helpers (or public_* views) — never
 * query other users from `profiles` directly.
 *
 * Self-queries still use direct profiles table access (owner policy).
 */
import { supabase } from "@/integrations/supabase/client";

export interface PublicProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  gender: string | null;
  age: number | null;
  bio: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  photo_url: string | null;
  primary_language: string | null;
  preferred_language: string | null;
  language: string | null;
  interests: string[] | null;
  life_goals: string[] | null;
  occupation: string | null;
  education_level: string | null;
  religion: string | null;
  marital_status: string | null;
  height_cm: number | null;
  body_type: string | null;
  is_verified: boolean | null;
  is_premium: boolean | null;
  account_status: string;
  approval_status: string;
  profile_completeness: number | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  is_indian: boolean | null;
  is_earning_eligible: boolean | null;
  earning_badge_type: string | null;
  performance_score: number | null;
  avg_response_time_seconds: number | null;
  total_chats_count: number | null;
  monthly_chat_minutes: number | null;
  verification_status: boolean | null;
  promoted_from_free: boolean | null;
  ai_approved: boolean | null;
}

/** Profile shape used by match discovery / matching lists */
export interface BrowsableMatchProfile {
  user_id: string;
  full_name: string | null;
  photo_url: string | null;
  gender: string;
  age: number | null;
  bio: string | null;
  country: string | null;
  state: string | null;
  preferred_language: string | null;
  primary_language: string | null;
  interests: string[] | null;
  education_level: string | null;
  occupation: string | null;
  religion: string | null;
  marital_status: string | null;
  height_cm: number | null;
  body_type: string | null;
  is_verified: boolean | null;
  is_premium: boolean | null;
  last_active_at: string | null;
  ai_approved: boolean | null;
  approval_status: string | null;
}

const PUBLIC_PROFILE_CHUNK = 80;

/**
 * Fetch public profile data for one or more users (excludes sensitive fields)
 */
export async function fetchPublicProfiles(userIds: string[]): Promise<PublicProfile[]> {
  if (!userIds.length) return [];

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const results: PublicProfile[] = [];

  for (let i = 0; i < uniqueIds.length; i += PUBLIC_PROFILE_CHUNK) {
    const chunk = uniqueIds.slice(i, i + PUBLIC_PROFILE_CHUNK);
    const { data, error } = await supabase.rpc("get_public_profiles", {
      user_ids: chunk,
    });

    if (error) {
      console.error("Error fetching public profiles:", error);
      continue;
    }
    results.push(...((data || []) as PublicProfile[]));
  }

  return results;
}

/**
 * Fetch a single public profile by user_id
 */
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const profiles = await fetchPublicProfiles([userId]);
  return profiles[0] || null;
}

/**
 * Browse opposite-gender candidates for matching/discovery.
 * Uses public_female_profiles / male_profiles (not locked `profiles` RLS).
 */
export async function fetchBrowsableOppositeProfiles(
  oppositeGender: "male" | "female",
  options?: { userIds?: string[]; requirePhoto?: boolean; limit?: number },
): Promise<BrowsableMatchProfile[]> {
  const limit = options?.limit ?? 100;
  const requirePhoto = options?.requirePhoto ?? true;
  const filterIds = options?.userIds?.filter(Boolean);

  if (filterIds && filterIds.length === 0) return [];

  if (oppositeGender === "female") {
    let query = supabase
      .from("public_female_profiles")
      .select(
        "user_id, full_name, photo_url, age, bio, country, state, preferred_language, primary_language, interests, is_verified, is_premium, last_active_at, approval_status",
      )
      .limit(limit);

    if (filterIds) query = query.in("user_id", filterIds);
    if (requirePhoto) {
      query = query.not("photo_url", "is", null).neq("photo_url", "");
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error browsing female profiles:", error);
      return [];
    }

    const rows = (data || []) as Array<{
      user_id: string;
      full_name: string | null;
      photo_url: string | null;
      age: number | null;
      bio: string | null;
      country: string | null;
      state: string | null;
      preferred_language: string | null;
      primary_language: string | null;
      interests: string[] | null;
      is_verified: boolean | null;
      is_premium: boolean | null;
      last_active_at: string | null;
      approval_status: string | null;
    }>;

    // Enrich with get_public_profiles when available (more score fields)
    const enriched = await fetchPublicProfiles(rows.map((r) => r.user_id));
    const enrichedMap = new Map(enriched.map((p) => [p.user_id, p]));

    return rows.map((r) => {
      const e = enrichedMap.get(r.user_id);
      return {
        user_id: r.user_id,
        full_name: e?.full_name ?? r.full_name,
        photo_url: e?.photo_url ?? r.photo_url,
        gender: "female",
        age: e?.age ?? r.age,
        bio: e?.bio ?? r.bio,
        country: e?.country ?? r.country,
        state: e?.state ?? r.state,
        preferred_language: e?.preferred_language ?? r.preferred_language,
        primary_language: e?.primary_language ?? r.primary_language,
        interests: e?.interests ?? r.interests,
        education_level: e?.education_level ?? null,
        occupation: e?.occupation ?? null,
        religion: e?.religion ?? null,
        marital_status: e?.marital_status ?? null,
        height_cm: e?.height_cm ?? null,
        body_type: e?.body_type ?? null,
        is_verified: e?.is_verified ?? r.is_verified,
        is_premium: e?.is_premium ?? r.is_premium,
        last_active_at: e?.last_active_at ?? r.last_active_at,
        ai_approved: e?.ai_approved ?? true,
        approval_status: e?.approval_status ?? r.approval_status ?? "approved",
      };
    });
  }

  // Male candidates (women discovering men)
  let maleQuery = supabase
    .from("male_profiles")
    .select(
      "user_id, full_name, photo_url, age, bio, country, state, preferred_language, primary_language, interests, education_level, occupation, religion, marital_status, height_cm, body_type, is_verified, is_premium, last_active_at, account_status",
    )
    .eq("account_status", "active")
    .limit(limit);

  if (filterIds) maleQuery = maleQuery.in("user_id", filterIds);
  if (requirePhoto) {
    maleQuery = maleQuery.not("photo_url", "is", null).neq("photo_url", "");
  }

  const { data: maleData, error: maleError } = await maleQuery;
  if (maleError) {
    console.error("Error browsing male profiles:", maleError);
    return [];
  }

  const maleRows = (maleData || []) as Array<{
    user_id: string;
    full_name: string | null;
    photo_url: string | null;
    age: number | null;
    bio: string | null;
    country: string | null;
    state: string | null;
    preferred_language: string | null;
    primary_language: string | null;
    interests: string[] | null;
    education_level: string | null;
    occupation: string | null;
    religion: string | null;
    marital_status: string | null;
    height_cm: number | null;
    body_type: string | null;
    is_verified: boolean | null;
    is_premium: boolean | null;
    last_active_at: string | null;
  }>;

  return maleRows.map((r) => ({
    user_id: r.user_id,
    full_name: r.full_name,
    photo_url: r.photo_url,
    gender: "male",
    age: r.age,
    bio: r.bio,
    country: r.country,
    state: r.state,
    preferred_language: r.preferred_language,
    primary_language: r.primary_language,
    interests: r.interests,
    education_level: r.education_level,
    occupation: r.occupation,
    religion: r.religion,
    marital_status: r.marital_status,
    height_cm: r.height_cm,
    body_type: r.body_type,
    is_verified: r.is_verified,
    is_premium: r.is_premium,
    last_active_at: r.last_active_at,
    ai_approved: true,
    approval_status: "approved",
  }));
}
