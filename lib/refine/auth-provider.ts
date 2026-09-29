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
    return { success: false, error: { message: "Invalid email or password", statusCode: 401, name: "Auth" } };
  },

  logout: async () => {
    await signOut({ redirect: false });
    return { success: true, redirectTo: "/ys-admin/login" };
  },

  check: async () => {
    const res = await fetch("/api/auth/session");
    const session = await res.json().catch(() => null);
    if (session?.user && (session.user as { role?: string }).role === "ADMIN") {
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
