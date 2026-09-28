import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { setCachedRole } from "@/lib/store";

type GateState = "loading" | "no-session" | "no-access" | "ok";

const LOGIN_URL =
  "https://portal.richfromanywhere.com/login?next=https%3A%2F%2Fmembers.richfromanywhere.com%2F";

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          window.location.replace(LOGIN_URL);
          return;
        }
        // Query profiles — read role + is_admin + status
        const { data, error } = await supabase
          .from("profiles")
          .select("is_admin, status, role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          setState("no-access");
          return;
        }
        // Pre-seed the role cache so store.ts never queries profiles again
        const role = (data.role as string) || "";
        setCachedRole(role);

        // owner or admin gets full access; staff gets read-only access; anything else denied
        if (
          role === "owner" ||
          (data.is_admin === true && data.status === "active") ||
          role === "staff"
        ) {
          setState("ok");
        } else {
          setState("no-access");
        }
      } catch {
        if (!cancelled) setState("no-access");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </div>
    );
  }

  if (state === "no-access") {
    return (
      <div className="flex items-center justify-center h-screen bg-background px-6">
        <div className="text-center max-w-md">
          <p className="text-lg font-semibold text-foreground">
            You don't have access to this page
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.replace(LOGIN_URL);
            }}
            className="mt-6 text-sm text-primary underline hover:opacity-80"
          >
            Sign out and return to login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
