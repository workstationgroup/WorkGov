"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Fingerprint, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  passkeyCount: number;
}

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.isAdmin === true;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin && session !== undefined) {
      router.replace("/settings/schedule");
      return;
    }
    fetchUsers();
  }, [fetchUsers, isAdmin, session, router]);

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">User Management</CardTitle>
        <CardDescription>
          View all users and manage their passkeys. Remove passkeys to
          force a user to sign in with Microsoft 365 on their next visit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  {u.image ? (
                    <img src={u.image} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                      {u.name ? u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {u.name || "Unknown"}
                      {u.id === session?.user?.id && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={u.passkeyCount > 0 ? "bg-green-50 text-green-700 border-green-200 text-xs" : "text-xs"}
                  >
                    <Fingerprint className="h-3 w-3 mr-1" />
                    {u.passkeyCount}
                  </Badge>
                  {u.passkeyCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={async () => {
                        await fetch("/api/admin/users", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: u.id }),
                        });
                        setUsers((prev) => prev.map((au) => (au.id === u.id ? { ...au, passkeyCount: 0 } : au)));
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove Passkeys
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No users yet.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
