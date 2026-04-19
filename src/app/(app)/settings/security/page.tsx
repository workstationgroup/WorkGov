"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trash2, Loader2, Fingerprint, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/webauthn";

interface PasskeyInfo {
  credentialID: string;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  transports: string | null;
}

export default function SecurityPage() {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPasskeys = useCallback(async () => {
    const res = await fetch("/api/passkeys");
    if (res.ok) setPasskeys(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchPasskeys(); }, [fetchPasskeys]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Passkeys</CardTitle>
        <CardDescription>
          Sign in with Face ID, Touch ID, or Windows Hello instead of
          Microsoft 365. Register a passkey after your first sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {passkeys.map((pk) => (
              <div key={pk.credentialID} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <div>
                    <p className="text-sm font-medium">
                      {pk.credentialDeviceType === "singleDevice" ? "Device Passkey" : "Synced Passkey"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pk.credentialBackedUp ? "Backed up" : "This device only"}
                      {pk.transports ? ` · ${pk.transports}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await fetch("/api/passkeys", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ credentialID: pk.credentialID }),
                    });
                    setPasskeys((prev) => prev.filter((p) => p.credentialID !== pk.credentialID));
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            {passkeys.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No passkeys registered. Add one below for faster sign-in.
              </p>
            )}
          </div>
        )}
        <Separator />
        {message && (
          <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm">{message}</div>
        )}
        <Button
          onClick={async () => {
            setRegistering(true);
            setMessage(null);
            try {
              await signIn("passkey", { action: "register", redirect: false });
              setMessage("Passkey registered successfully!");
              fetchPasskeys();
            } catch {
              setMessage("Registration failed. Please try again.");
            } finally {
              setRegistering(false);
            }
          }}
          disabled={registering}
          className="gap-2"
        >
          {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
          {registering ? "Waiting for device..." : "Register New Passkey"}
        </Button>
      </CardContent>
    </Card>
  );
}
