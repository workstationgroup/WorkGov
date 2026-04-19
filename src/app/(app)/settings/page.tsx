"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Clock,
  Key,
  MessageCircle,
  Search,
  Loader2,
  Fingerprint,
  ShieldCheck,
  Users,
} from "lucide-react";
import { signIn } from "next-auth/webauthn";
import { useSession } from "next-auth/react";

interface Schedule {
  id: number;
  time: string;
  enabled: boolean;
}

interface Keyword {
  id: number;
  keyword: string;
  type: "type_a" | "type_b";
  enabled: boolean;
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  passkeyCount: number;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin === true;

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(true);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingKeywords, setLoadingKeywords] = useState(true);
  const [newTime, setNewTime] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordType, setNewKeywordType] = useState<"type_a" | "type_b">(
    "type_a"
  );

  const [lineEnabled, setLineEnabled] = useState(true);

  // Passkey state
  interface PasskeyInfo {
    credentialID: string;
    credentialDeviceType: string;
    credentialBackedUp: boolean;
    transports: string | null;
  }
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    const res = await fetch("/api/schedules");
    const data = await res.json();
    setSchedules(data);
    setLoadingSchedules(false);
  }, []);

  const fetchKeywords = useCallback(async () => {
    const res = await fetch("/api/keywords");
    const data = await res.json();
    setKeywords(data);
    setLoadingKeywords(false);
  }, []);

  const fetchAdminUsers = useCallback(async () => {
    if (!isAdmin) return;
    const res = await fetch("/api/admin/users");
    if (res.ok) setAdminUsers(await res.json());
    setLoadingAdminUsers(false);
  }, [isAdmin]);

  const fetchPasskeys = useCallback(async () => {
    const res = await fetch("/api/passkeys");
    if (res.ok) setPasskeys(await res.json());
    setLoadingPasskeys(false);
  }, []);

  const fetchLineEnabled = useCallback(async () => {
    const res = await fetch("/api/settings?key=line_enabled");
    const data = await res.json();
    if (data) {
      setLineEnabled(data.value === "true");
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchKeywords();
    fetchLineEnabled();
    fetchPasskeys();
    fetchAdminUsers();
  }, [fetchSchedules, fetchKeywords, fetchLineEnabled, fetchPasskeys, fetchAdminUsers]);

  async function addSchedule() {
    if (!newTime) return;
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time: newTime }),
    });
    if (res.ok) {
      const row = await res.json();
      setSchedules((prev) => [...prev, row].sort((a, b) => a.time.localeCompare(b.time)));
      setNewTime("");
    }
  }

  async function removeSchedule(id: number) {
    await fetch(`/api/schedules?id=${id}`, { method: "DELETE" });
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  async function toggleSchedule(id: number, enabled: boolean) {
    await fetch("/api/schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !enabled }),
    });
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }

  async function addKeyword() {
    if (!newKeyword) return;
    const res = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: newKeyword, type: newKeywordType }),
    });
    if (res.ok) {
      const row = await res.json();
      setKeywords((prev) => [...prev, row]);
      setNewKeyword("");
    }
  }

  async function removeKeyword(id: number) {
    await fetch(`/api/keywords?id=${id}`, { method: "DELETE" });
    setKeywords((prev) => prev.filter((k) => k.id !== id));
  }

  async function toggleKeyword(id: number, enabled: boolean) {
    await fetch("/api/keywords", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !enabled }),
    });
    setKeywords((prev) =>
      prev.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k))
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure e-GP monitoring, keywords, and notifications
        </p>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule" className="gap-2">
            <Clock className="h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="keywords" className="gap-2">
            <Search className="h-4 w-4" />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Fingerprint className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="credentials" className="gap-2">
            <Key className="h-4 w-4" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="line" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            LINE
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin" className="gap-2">
              <Users className="h-4 w-4" />
              Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="schedule" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Scrape Schedule</CardTitle>
              <CardDescription>
                Configure when WorkGov checks e-GP for new tenders. Times are in
                UTC+7 (Thailand).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingSchedules ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={schedule.enabled}
                          onCheckedChange={() =>
                            toggleSchedule(schedule.id, schedule.enabled)
                          }
                        />
                        <span className="text-sm font-mono font-medium">
                          {schedule.time}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          UTC+7
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSchedule(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  {schedules.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No schedules configured. Add a time below.
                    </p>
                  )}
                </div>
              )}
              <Separator />
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-[140px]"
                />
                <Button variant="outline" size="sm" onClick={addSchedule}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Time
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keywords" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Search Keywords</CardTitle>
              <CardDescription>
                Keywords used to search for relevant tenders on e-GP. Type A for
                direct bidding, Type B for future opportunities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingKeywords ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {keywords.map((kw) => (
                    <div
                      key={kw.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={kw.enabled}
                          onCheckedChange={() =>
                            toggleKeyword(kw.id, kw.enabled)
                          }
                        />
                        <span className="text-sm font-medium">
                          {kw.keyword}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            kw.type === "type_a"
                              ? "bg-sky-100 text-sky-800 border-sky-200 text-[10px]"
                              : "bg-amber-100 text-amber-800 border-amber-200 text-[10px]"
                          }
                        >
                          {kw.type === "type_a" ? "A" : "B"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeKeyword(kw.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  {keywords.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No keywords configured. Add one below.
                    </p>
                  )}
                </div>
              )}
              <Separator />
              <div className="flex items-center gap-2">
                <Input
                  placeholder="New keyword..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addKeyword();
                  }}
                />
                <div className="flex items-center gap-1">
                  <Button
                    variant={
                      newKeywordType === "type_a" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setNewKeywordType("type_a")}
                  >
                    A
                  </Button>
                  <Button
                    variant={
                      newKeywordType === "type_b" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setNewKeywordType("type_b")}
                  >
                    B
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={addKeyword}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Passkeys</CardTitle>
              <CardDescription>
                Sign in with Face ID, Touch ID, or Windows Hello instead of
                Microsoft 365. Register a passkey after your first sign-in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingPasskeys ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {passkeys.map((pk) => (
                    <div
                      key={pk.credentialID}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-4 w-4 text-accent" />
                        <div>
                          <p className="text-sm font-medium">
                            {pk.credentialDeviceType === "singleDevice"
                              ? "Device Passkey"
                              : "Synced Passkey"}
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
                          setPasskeys((prev) =>
                            prev.filter((p) => p.credentialID !== pk.credentialID)
                          );
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
              {passkeyMessage && (
                <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm">
                  {passkeyMessage}
                </div>
              )}
              <Button
                onClick={async () => {
                  setRegisteringPasskey(true);
                  setPasskeyMessage(null);
                  try {
                    await signIn("passkey", { action: "register", redirect: false });
                    setPasskeyMessage("Passkey registered successfully!");
                    fetchPasskeys();
                  } catch {
                    setPasskeyMessage("Registration failed. Please try again.");
                  } finally {
                    setRegisteringPasskey(false);
                  }
                }}
                disabled={registeringPasskey}
                className="gap-2"
              >
                {registeringPasskey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Fingerprint className="h-4 w-4" />
                )}
                {registeringPasskey ? "Waiting for device..." : "Register New Passkey"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">e-GP Credentials</CardTitle>
              <CardDescription>
                Login credentials for the e-GP system
                (process5.gprocurement.go.th). These are stored securely as
                environment variables.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="egp-username">Username</Label>
                <Input
                  id="egp-username"
                  placeholder="Set via EGP_USERNAME env variable"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="egp-password">Password</Label>
                <Input
                  id="egp-password"
                  type="password"
                  placeholder="Set via EGP_PASSWORD env variable"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data-api-key">data.go.th API Key</Label>
                <Input
                  id="data-api-key"
                  placeholder="Set via DATA_GO_TH_API_KEY env variable"
                  disabled
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Credentials are managed through Vercel environment variables for
                security. Set them in your Vercel project settings or via the
                CLI.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="line" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">
                LINE Notifications
              </CardTitle>
              <CardDescription>
                Configure LINE Messaging API to send tender alerts to your team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="line-channel-token">
                  Channel Access Token
                </Label>
                <Input
                  id="line-channel-token"
                  placeholder="Set via LINE_CHANNEL_ACCESS_TOKEN env variable"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="line-group-id">Group ID</Label>
                <Input
                  id="line-group-id"
                  placeholder="Set via LINE_GROUP_ID env variable"
                  disabled
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Enable LINE Notifications
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Send alerts when new relevant tenders are found
                  </p>
                </div>
                <Switch
                  checked={lineEnabled}
                  onCheckedChange={async (checked) => {
                    setLineEnabled(checked);
                    await fetch("/api/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        key: "line_enabled",
                        value: String(checked),
                      }),
                    });
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                LINE credentials are managed through Vercel environment
                variables for security.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        {isAdmin && (
          <TabsContent value="admin" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">User Management</CardTitle>
                <CardDescription>
                  View all users and manage their passkeys. Remove passkeys to
                  force a user to sign in with Microsoft 365 on their next visit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAdminUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          {u.image ? (
                            <img
                              src={u.image}
                              alt=""
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                              {u.name
                                ? u.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)
                                : "?"}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {u.name || "Unknown"}
                              {u.id === session?.user?.id && (
                                <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {u.email || "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              u.passkeyCount > 0
                                ? "bg-green-50 text-green-700 border-green-200 text-xs"
                                : "text-xs"
                            }
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
                                setAdminUsers((prev) =>
                                  prev.map((au) =>
                                    au.id === u.id
                                      ? { ...au, passkeyCount: 0 }
                                      : au
                                  )
                                );
                              }}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove Passkeys
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {adminUsers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No users yet.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
