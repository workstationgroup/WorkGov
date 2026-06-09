"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Loader2, Send, Check, X } from "lucide-react";

interface LineTarget {
  id: number;
  lineId: string;
  name: string;
  kind: string;
  enabled: boolean;
}

type TestState = "idle" | "sending" | "ok" | "fail";

export default function LinePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin === true;

  const [lineEnabled, setLineEnabled] = useState(true);
  const [targets, setTargets] = useState<LineTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newLineId, setNewLineId] = useState("");
  const [testState, setTestState] = useState<Record<number, TestState>>({});

  const fetchLineEnabled = useCallback(async () => {
    const res = await fetch("/api/settings?key=line_enabled");
    const data = await res.json();
    if (data) setLineEnabled(data.value === "true");
  }, []);

  const fetchTargets = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    const res = await fetch("/api/line-targets");
    if (res.ok) setTargets(await res.json());
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    fetchLineEnabled();
  }, [fetchLineEnabled]);

  useEffect(() => {
    if (session !== undefined) fetchTargets();
  }, [fetchTargets, session]);

  async function addTarget() {
    if (!newLineId.trim()) return;
    const res = await fetch("/api/line-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineId: newLineId.trim(), name: newName.trim() }),
    });
    if (res.ok) {
      const created = await res.json();
      setTargets((prev) => [...prev, created]);
      setNewName("");
      setNewLineId("");
    }
  }

  async function toggleTarget(id: number, enabled: boolean) {
    setTargets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled } : t))
    );
    await fetch("/api/line-targets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
  }

  async function renameTarget(id: number, name: string) {
    setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    await fetch("/api/line-targets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
  }

  async function removeTarget(id: number) {
    await fetch(`/api/line-targets?id=${id}`, { method: "DELETE" });
    setTargets((prev) => prev.filter((t) => t.id !== id));
  }

  async function testTarget(id: number) {
    setTestState((s) => ({ ...s, [id]: "sending" }));
    const res = await fetch("/api/line-targets/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTestState((s) => ({ ...s, [id]: res.ok ? "ok" : "fail" }));
    setTimeout(
      () => setTestState((s) => ({ ...s, [id]: "idle" })),
      3000
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">LINE Notifications</CardTitle>
          <CardDescription>
            Send tender alerts to one or more LINE groups via the LINE Messaging
            API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="line-channel-token">Channel Access Token</Label>
            <Input
              id="line-channel-token"
              placeholder="Set via LINE_CHANNEL_ACCESS_TOKEN env variable"
              disabled
            />
            <p className="text-xs text-muted-foreground">
              The channel token is managed through Vercel environment variables
              for security.
            </p>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable LINE Notifications</p>
              <p className="text-xs text-muted-foreground">
                Master switch — when off, no alerts are sent to any group.
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">LINE Groups</CardTitle>
          <CardDescription>
            Alerts are sent to every group toggled on below. To add a group,
            invite the WorkGov bot to it and send any message — the group then
            appears here automatically; just name it and switch it on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAdmin ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Admin access is required to manage LINE groups.
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {targets.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <Switch
                      checked={t.enabled}
                      onCheckedChange={(c) => toggleTarget(t.id, c)}
                    />
                    <div className="flex-1 min-w-0">
                      <Input
                        value={t.name}
                        placeholder="(unnamed group)"
                        className="h-8 border-0 px-0 shadow-none focus-visible:ring-0 font-medium"
                        onChange={(e) =>
                          setTargets((prev) =>
                            prev.map((x) =>
                              x.id === t.id ? { ...x, name: e.target.value } : x
                            )
                          )
                        }
                        onBlur={(e) => renameTarget(t.id, e.target.value.trim())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground truncate font-mono">
                        {t.kind} · {t.lineId}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Send test message"
                      disabled={testState[t.id] === "sending"}
                      onClick={() => testTarget(t.id)}
                    >
                      {testState[t.id] === "sending" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : testState[t.id] === "ok" ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : testState[t.id] === "fail" ? (
                        <X className="h-4 w-4 text-destructive" />
                      ) : (
                        <Send className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTarget(t.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                {targets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No LINE groups yet. Invite the bot to a group and send a
                    message, or add a group ID manually below.
                  </p>
                )}
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Group name (optional)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="LINE group ID (C…)"
                  value={newLineId}
                  onChange={(e) => setNewLineId(e.target.value)}
                  className="flex-1 font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTarget();
                  }}
                />
                <Button variant="outline" size="sm" onClick={addTarget}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
