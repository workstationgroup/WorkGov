import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const ALLOWED_DOMAIN = "workstationoffice.com";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET?.trim(),
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim(),
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim(),
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim(),
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    signIn({ profile }) {
      // Only allow @workstationoffice.com emails
      const email =
        (profile as Record<string, unknown>)?.email ||
        (profile as Record<string, unknown>)?.preferred_username ||
        "";
      if (typeof email === "string" && email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return true;
      }
      return false;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
