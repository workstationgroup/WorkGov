"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn as msSignIn } from "next-auth/react";
import { signIn as passkeySignIn } from "next-auth/webauthn";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleMicrosoft() {
    setLoading("microsoft");
    setError(null);
    await msSignIn("microsoft-entra-id", { callbackUrl: "/dashboard" });
  }

  async function handlePasskey() {
    setLoading("passkey");
    setError(null);
    try {
      await passkeySignIn("passkey", { callbackUrl: "/dashboard" });
    } catch {
      setError("Passkey sign-in failed. Please try again or use Microsoft 365.");
      setLoading(null);
    }
  }

  // Check URL for error param
  const urlError =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("error")
      : null;
  const displayError = error || (urlError === "AccessDenied"
    ? "Access denied. Only @workstationoffice.com accounts are allowed."
    : urlError
      ? "Sign in failed. Please try again."
      : null);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo-workstation.jpg"
            alt="Work Station"
            width={120}
            height={120}
            className="rounded-2xl"
            priority
          />
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              WorkGov
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tender Management System
            </p>
          </div>
        </div>

        {/* Error message */}
        {displayError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {displayError}
          </div>
        )}

        {/* Sign-in buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handlePasskey}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" />
              <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
            </svg>
            {loading === "passkey" ? "Waiting for passkey..." : "Sign in with Passkey"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMicrosoft}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            {loading === "microsoft" ? "Redirecting..." : "Sign in with Microsoft 365"}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Work Station Office employees only
        </p>
      </div>
    </div>
  );
}
