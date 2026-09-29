import { signIn, signOut } from "next-auth/react";
import type { AuthProvider } from "@refinedev/core";

/**
 * Refine AuthProvider bridged to Auth.js credentials.
 * Session cookies are the transport, so the dataProvider needs no token plumbing.
 */
export const authProvider: AuthProvider = {
  login: async ({ email, password }: { email: string; password: string }) => {
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.ok) return { success: true, redirectTo: "/ys-admin/vendors" };
    // Auth.js surfaces custom credential failures as ?error=CredentialsSignin&code=…
    // (signIn redirect:false exposes it as res.code; res.url is null on error).
    const suspended = (res as { code?: string } | undefined)?.code === "SUSPENDED";
    return {
      success: false,
      error: {
        message: suspended ? "This account is suspended. Contact support." : "Invalid email or password",
        statusCode: suspended ? 403 : 401,
        name: "Auth",
      },
    };
  },

  logout: async () => {
    await signOut({ redirect: false });
    return { success: true, redirectTo: "/ys-admin/login" };
  },

  check: async () => {
    const res = await fetch("/api/auth/session");
    const session = await res.json().catch(() => null);
    const role = (session?.user as { role?: string } | undefined)?.role;
    const scopes = (session?.user as { scopes?: string[] } | undefined)?.scopes ?? [];
    // Console-level gate (areas are enforced per page by middleware).
    if (session?.user && (role === "ADMIN" || scopes.length > 0)) {
      return { authenticated: true };
    }
    return { authenticated: false, logout: true, redirectTo: "/ys-admin/login" };
  },

  onError: async (error) => {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return { logout: true, redirectTo: "/ys-admin/login", error };
    }
    return { error };
  },

  getIdentity: async () => {
    const res = await fetch("/api/auth/session");
    const session = await res.json().catch(() => null);
    return session?.user ?? null;
  },
};
