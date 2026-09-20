import { toast } from "sonner";
/**
 * ProtectedRoute – single source of route guarding.
 *
 * Uses the global useAuthReady() hook so every component shares the same
 * session state. Role check result is cached in module-level state to avoid
 * redundant DB queries on every route navigation.
 */
import { useState, useEffect, useRef, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady, isSignedOut } from "@/hooks/useAuthReady";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type RequiredRole = "male" | "female" | "admin" | "authenticated";

interface Props {
  children: React.ReactNode;
  requiredRole?: RequiredRole;
}

// ── Module-level role cache ─────────────────────────────────────────
// Caches the last role-check result per user to avoid 3x DB queries on every
// protected route mount. Invalidated on SIGNED_OUT.
interface RoleCacheEntry {
  userId: string;
  isAdmin: boolean;
  isFemale: boolean;
  isMale: boolean;
  timestamp: number;
}

let roleCache: RoleCacheEntry | null = null;
const ROLE_CACHE_TTL = 15_000; // BUG-04 FIX: 15s — reduces stale role window

export function clearRoleCache() {
  roleCache = null;
}

export function clearCaptchaPassCache() {
  captchaPassCache = null;
}

// Captcha verification persistence — keyed per user in localStorage so a page
// refresh (or transient SIGNED_OUT flap during session restore) never forces
// the user back through CAPTCHA. Expires after 24h.
const CAPTCHA_TTL_MS = 24 * 60 * 60 * 1000;

/** In-tab cache so navigating between protected routes does not re-prompt CAPTCHA. */
let captchaPassCache: { userId: string; timestamp: number } | null = null;

export function markCaptchaVerified(userId: string) {
  const now = Date.now();
  captchaPassCache = { userId, timestamp: now };
  try {
    sessionStorage.setItem("captchaVerifiedAt", String(now));
    localStorage.setItem(`captchaVerifiedFor:${userId}`, String(now));
  } catch {
    /* ignore quota */
  }
}

function isCaptchaVerified(userId: string | undefined): boolean {
  if (!userId) return false;
  if (
    captchaPassCache &&
    captchaPassCache.userId === userId &&
    Date.now() - captchaPassCache.timestamp < CAPTCHA_TTL_MS
  ) {
    return true;
  }
  try {
    // Back-compat: legacy session flag still counts.
    if (sessionStorage.getItem("captchaVerifiedAt")) {
      const ts = parseInt(sessionStorage.getItem("captchaVerifiedAt") || "", 10);
      if (Number.isFinite(ts) && Date.now() - ts < CAPTCHA_TTL_MS) {
        captchaPassCache = { userId, timestamp: ts };
        return true;
      }
    }
    const raw = localStorage.getItem(`captchaVerifiedFor:${userId}`);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    const ok = Number.isFinite(ts) && Date.now() - ts < CAPTCHA_TTL_MS;
    if (ok) captchaPassCache = { userId, timestamp: ts };
    return ok;
  } catch {
    return false;
  }
}

const GENDER_TTL_MS = 24 * 60 * 60 * 1000;
/** Flip to true to restore login face/gender verification. */
export const LOGIN_GENDER_VERIFY_ENABLED = false;

export function isGenderVerified(userId: string | undefined): boolean {
  if (!LOGIN_GENDER_VERIFY_ENABLED) return true;
  if (!userId) return false;
  try {
    // Must be per-user — a shared session flag lets the next login
    // (e.g. male after female) skip the photo check in the same browser.
    const sessionRaw = sessionStorage.getItem(`genderVerifiedFor:${userId}`);
    if (sessionRaw) {
      const ts = parseInt(sessionRaw, 10);
      if (Number.isFinite(ts) && Date.now() - ts < GENDER_TTL_MS) return true;
    }
    const raw = localStorage.getItem(`genderVerifiedFor:${userId}`);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Number.isFinite(ts) && Date.now() - ts < GENDER_TTL_MS;
  } catch {
    return false;
  }
}

export function markGenderVerified(userId: string) {
  try {
    const now = String(Date.now());
    sessionStorage.setItem(`genderVerifiedFor:${userId}`, now);
    localStorage.setItem(`genderVerifiedFor:${userId}`, now);
    // Drop legacy unscoped flag from earlier builds
    sessionStorage.removeItem("genderVerifiedAt");
  } catch {
    /* ignore quota */
  }
}

/** Clear gender/captcha session grants so a fresh login always re-checks. */
export function clearLoginGateSessionFlags() {
  try {
    sessionStorage.removeItem("genderVerifiedAt");
    sessionStorage.removeItem("captchaVerifiedAt");
    sessionStorage.removeItem("postCaptchaRedirect");
  } catch {}
}

// Listen for sign-out to invalidate cache (module-level, runs once)
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    clearRoleCache();
    captchaPassCache = null;
    // NOTE: do NOT clear captchaVerifiedFor:* here. SIGNED_OUT can fire on
    // transient token-refresh failures; clearing would log the user out of
    // their CAPTCHA grant on every refresh. The TTL handles staleness.
    try {
      sessionStorage.removeItem("captchaVerifiedAt");
      sessionStorage.removeItem("genderVerifiedAt");
      sessionStorage.removeItem("postCaptchaRedirect");
      // Per-user session keys are cleared by TTL; wipe any still in this tab
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith("genderVerifiedFor:")) sessionStorage.removeItem(k);
      }
    } catch {}
  }
});

const ProtectedRoute = ({ children, requiredRole = "authenticated" }: Props) => {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const checkedForUser = useRef<string | null>(null);
  const REVALIDATE_INTERVAL_MS = 60_000;

  // Resolve role info — uses cache if valid
  const resolveRoles = async (userId: string, forceRefresh = false): Promise<RoleCacheEntry> => {
    // Return cached result if fresh
    if (
      !forceRefresh &&
      roleCache &&
      roleCache.userId === userId &&
      Date.now() - roleCache.timestamp < ROLE_CACHE_TTL
    ) {
      return roleCache;
    }

    const MAX_RETRIES = forceRefresh ? 1 : 3;
    let profileRes: any, femaleRes: any, adminRes: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000));
        const queries = Promise.all([
          supabase.from("profiles").select("gender").eq("user_id", userId).maybeSingle(),
          supabase.from("female_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle(),
        ]);
        [profileRes, femaleRes, adminRes] = (await Promise.race([queries, timeout])) as any;
        break;
      } catch (retryErr) {
        if (attempt < MAX_RETRIES) {
          console.warn(`[ProtectedRoute] Role check attempt ${attempt} failed, retrying...`);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        } else {
          throw retryErr;
        }
      }
    }

    const isAdmin = !!adminRes.data;
    const declaredGender = profileRes.data?.gender?.toLowerCase();
    const isFemale = declaredGender === "female" || (declaredGender !== "male" && !!femaleRes.data);
    const isMale = !isFemale && !isAdmin;

    const entry: RoleCacheEntry = {
      userId,
      isAdmin,
      isFemale,
      isMale,
      timestamp: Date.now(),
    };
    roleCache = entry;
    return entry;
  };

  // Evaluate authorization against required role
  const evaluateAccess = (roles: RoleCacheEntry): { ok: boolean; to: string } => {
    let ok = false;
    let to = "/";

    switch (requiredRole) {
      case "admin":
        ok = roles.isAdmin;
        if (!ok) to = roles.isFemale ? "/women-dashboard" : "/dashboard";
        break;
      case "female":
        ok = roles.isFemale && !roles.isAdmin;
        if (!ok) to = roles.isAdmin ? "/admin" : "/dashboard";
        break;
      case "male":
        ok = roles.isMale && !roles.isAdmin;
        if (!ok) to = roles.isAdmin ? "/admin" : roles.isFemale ? "/women-dashboard" : "/dashboard";
        break;
      case "authenticated":
        ok = true;
        break;
    }

    return { ok, to };
  };

  // Initial role check on mount / user change
  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      navigate("/", { replace: true });
      return;
    }

    if (checkedForUser.current === user.id) return;

    let mounted = true;
    setChecking(true);

    (async () => {
      try {
        const roles = await resolveRoles(user.id);
        if (!mounted) return;

        const target =
          requiredRole === "admin"
            ? "/admin"
            : requiredRole === "female"
              ? "/women-dashboard"
              : requiredRole === "male"
                ? "/dashboard"
                : window.location.pathname + window.location.search;

        // Photo gender check before CAPTCHA removed — go straight to CAPTCHA.
        if (!isCaptchaVerified(user.id)) {
          sessionStorage.setItem("postCaptchaRedirect", target);
          navigate("/captcha", { replace: true });
          return;
        }
        markCaptchaVerified(user.id);

        if (requiredRole === "authenticated") {
          checkedForUser.current = user.id;
          setAuthorized(true);
          return;
        }

        const { ok, to } = evaluateAccess(roles);
        if (ok) {
          checkedForUser.current = user.id;
          setAuthorized(true);
        } else {
          navigate(to, { replace: true });
        }
      } catch (e) {
        console.error("[ProtectedRoute]", e);
        if (mounted) navigate("/", { replace: true });
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id, isReady, requiredRole, navigate]);

  // Periodic re-validation: detect revoked roles while tab is open
  useEffect(() => {
    if (!authorized || !user || requiredRole === "authenticated") return;

    const interval = setInterval(async () => {
      try {
        const roles = await resolveRoles(user.id, true);
        const { ok, to } = evaluateAccess(roles);
        if (!ok) {
          console.warn(`[ProtectedRoute] Role revoked for user ${user.id}, redirecting`);
          checkedForUser.current = null;
          setAuthorized(false);
          toast.error("Your access permissions have changed. Redirecting...");
          navigate(to, { replace: true });
        }
      } catch {
        // Silently ignore transient network errors during revalidation
      }
    }, REVALIDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [authorized, user?.id, requiredRole, navigate]);

  // Back-button guard — sign-out is already handled by module-level listener & useAuthReady
  useEffect(() => {
    const handlePopState = () => {
      if (isSignedOut()) {
        window.history.replaceState(null, "", "/");
        navigate("/", { replace: true });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  // React to sign-out via useAuthReady (no extra subscription needed)
  useEffect(() => {
    if (isReady && !user && authorized) {
      checkedForUser.current = null;
      setAuthorized(false);
      navigate("/", { replace: true });
    }
  }, [isReady, user, authorized, navigate]);

  if (!isReady || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return authorized ? (
    <ErrorBoundary showHomeButton>
      <Suspense
        fallback={
          <div className="min-h-screen bg-background flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  ) : null;
};

export default ProtectedRoute;
