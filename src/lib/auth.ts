import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/status";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString() ?? "";
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          bankId: user.bankId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const account = user as { id: string; role: AppRole; bankId?: string | null };
        token.id = account.id;
        token.role = account.role;
        token.bankId = account.bankId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as AppRole;
      session.user.bankId = (token.bankId as string | null) ?? null;
      return session;
    },
  },
};
