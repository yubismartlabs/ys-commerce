import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

/** Distinct sign-in failure for suspended accounts (surfaces as code=SUSPENDED). */
class SuspendedSignin extends CredentialsSignin {
  code = "SUSPENDED";
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: { signIn: "/ys-admin/login" },
  providers: [
    Credentials({
      name: "Admin login",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        // Suspended accounts fail closed with a distinct code the UIs surface.
        if (user.suspendedAt) throw new SuspendedSignin();
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user && "role" in user) token.role = (user as { role: string }).role;
      // Client called update() (e.g. after become-seller): re-read role from DB.
      if (trigger === "update" && token.sub) {
        const fresh = await db.user.findUnique({ where: { id: token.sub }, select: { role: true } });
        if (fresh) token.role = fresh.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        (session.user as { role?: string }).role = typeof token.role === "string" ? token.role : "BUYER";
      }
      return session;
    },
  },
});
