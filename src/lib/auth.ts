import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Passkey from "next-auth/providers/passkey";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  authenticators,
} from "@/lib/db/schema";

const ALLOWED_DOMAIN = "workstationoffice.com";

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
        "/api/scrape",
        "/api/line-webhook",
        "/t/",
      ];
      if (publicPaths.some((p) => pathname.startsWith(p))) return true;
      return !!auth;
    },
    signIn({ profile, account }) {
      // Passkey sign-in: user already exists in DB, allow
      if (account?.provider === "passkey") return true;
      // Microsoft: only allow @workstationoffice.com emails
      const email =
        (profile as Record<string, unknown>)?.email ||
        (profile as Record<string, unknown>)?.preferred_username ||
        "";
      if (typeof email === "string" && email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return true;
      }
      return false;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
