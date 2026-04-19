"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/webauthn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Fingerprint, Loader2, ArrowRight } from "lucide-react";

export default function SetupPasskeyPage() {
  const router = useRouter();
  const [registering, setRegistering] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function skipSetup() {
    localStorage.setItem("passkey_setup_complete", "1");
    router.replace("/dashboard");
  }

  async function handleRegister() {
    setRegistering(true);
    setError(null);
    try {
      await signIn("passkey", { action: "register", redirect: false });
      localStorage.setItem("passkey_setup_complete", "1");
      setDone(true);
    } catch {
      setError("Registration failed. You can try again or skip for now.");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Fingerprint className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-heading text-xl">
            {done ? "Passkey Registered!" : "Set Up Fast Sign-In"}
          </CardTitle>
          <CardDescription>
            {done
              ? "Next time you can sign in with Face ID, Touch ID, or Windows Hello — no Microsoft login needed."
              : "Register a passkey to sign in faster next time using Face ID, Touch ID, or Windows Hello."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {done ? (
            <Button className="w-full gap-2" onClick={() => router.replace("/dashboard")}>
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <>
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button
                className="w-full gap-2"
                onClick={handleRegister}
                disabled={registering}
              >
                {registering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Fingerprint className="h-4 w-4" />
                )}
                {registering ? "Waiting for device..." : "Register Passkey"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={skipSetup}
                disabled={registering}
              >
                Skip for now
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
