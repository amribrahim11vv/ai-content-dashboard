import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getEntitlements, syncAuthDevice, type EntitlementsResponse } from "../api";
import { setAccessToken } from "../lib/authToken";
import { getDeviceId } from "../lib/deviceId";
import { isAgencyEdition, isV1PublicDecommissionEnabled } from "../lib/appEdition";
import { hasSupabaseAuth, supabase } from "./supabaseClient";

type AuthState = {
  ready: boolean;
  session: Session | null;
  entitlements: EntitlementsResponse | null;
  refreshEntitlements: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

function resolveAuthRedirectUrl(): string {
  const configured = String(import.meta.env.VITE_AUTH_REDIRECT_URL ?? "").trim();
  if (configured) return configured;
  if (isAgencyEdition()) return `${window.location.origin}/`;
  if (isV1PublicDecommissionEnabled()) return `${window.location.origin}/admin/legacy-v1`;
  return window.location.href;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null);

  const refreshEntitlements = async () => {
    try {
      const data = await getEntitlements();
      setEntitlements(data);
    } catch {
      setEntitlements(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!hasSupabaseAuth || !supabase) {
      setAccessToken("");
      void refreshEntitlements().finally(() => {
        if (mounted) setReady(true);
      });
      return () => {
        mounted = false;
      };
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setAccessToken(data.session?.access_token ?? "");
      if (data.session) {
        void syncAuthDevice(getDeviceId()).catch(() => {});
      }
      void refreshEntitlements().finally(() => {
        if (mounted) setReady(true);
      });
    });

    const sub = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAccessToken(nextSession?.access_token ?? "");
      if (nextSession) {
        void syncAuthDevice(getDeviceId()).catch(() => {});
      }
      void refreshEntitlements();
    });

    return () => {
      mounted = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      entitlements,
      refreshEntitlements,
      signInWithGoogle: async () => {
        if (!supabase) return;
        // Force a fresh auth handshake so V2 never reuses stale V1 local sessions.
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // Best effort only; continue with OAuth flow.
        }
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: resolveAuthRedirectUrl(),
            queryParams: {
              prompt: "select_account consent",
              ...(isAgencyEdition() ? {} : { access_type: "offline" }),
            },
          },
        });
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [ready, session, entitlements]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
