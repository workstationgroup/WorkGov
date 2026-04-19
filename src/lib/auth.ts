import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Passkey from "next-auth/providers/passkey";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  authenticators,
  settings,
} from "@/lib/db/schema";

const ALLOWED_DOMAIN = "workstationoffice.com";

async function checkIsAdmin(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "admin_user_id"));

  if (!row) {
    // First user ever — make them admin
    await db.insert(settings).values({ key: "admin_user_id", value: userId });
    return true;
  }

  return row.value === userId;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET?.trim(),
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  session: { strategy: "jwt" },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim(),
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim(),
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim(),
      allowDangerousEmailAccountLinking: true,
    }),
    Passkey({
      relayingParty: {
        id: process.env.AUTH_WEBAUTHN_RP_ID || "workgov.workstationoffice.com",
        name: "WorkGov",
        origin: process.env.AUTH_WEBAUTHN_ORIGIN || "https://workgov.workstationoffice.com",
      },
    }),
  ],
  experimental: { enableWebAuthn: true },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const publicPaths = [
        "/login",
        "/api/auth",
        "/api/cron",
        "/api/line-webhook",
        "/t/",
      ];
      if (publicPaths.some((p) => pathname.startsWith(p))) return true;
      return !!auth;
    },
    signIn({ profile, account }) {
      if (account?.provider === "passkey") return true;
      const email =
        (profile as Record<string, unknown>)?.email ||
        (profile as Record<string, unknown>)?.preferred_username ||
        "";
      if (typeof email === "string" && email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return true;
      }
      return false;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.sub = user.id;
      }
      // Check admin on sign-in only (not every request)
      if ((trigger === "signIn" || trigger === "signUp") && token.sub) {
        token.isAdmin = await checkIsAdmin(token.sub);
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.isAdmin) session.user.isAdmin = token.isAdmin as boolean;
      return session;
    },
  },
});
