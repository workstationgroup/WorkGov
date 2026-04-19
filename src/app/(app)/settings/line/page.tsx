"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function LinePage() {
  const [lineEnabled, setLineEnabled] = useState(true);

  const fetchLineEnabled = useCallback(async () => {
    const res = await fetch("/api/settings?key=line_enabled");
    const data = await res.json();
    if (data) setLineEnabled(data.value === "true");
  }, []);

  useEffect(() => { fetchLineEnabled(); }, [fetchLineEnabled]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">LINE Notifications</CardTitle>
        <CardDescription>
          Configure LINE Messaging API to send tender alerts to your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="line-channel-token">Channel Access Token</Label>
          <Input id="line-channel-token" placeholder="Set via LINE_CHANNEL_ACCESS_TOKEN env variable" disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="line-group-id">Group ID</Label>
          <Input id="line-group-id" placeholder="Set via LINE_GROUP_ID env variable" disabled />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enable LINE Notifications</p>
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
                body: JSON.stringify({ key: "line_enabled", value: String(checked) }),
              });
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          LINE credentials are managed through Vercel environment variables for security.
        </p>
      </CardContent>
    </Card>
  );
}
