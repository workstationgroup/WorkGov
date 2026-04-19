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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface Schedule {
  id: number;
  time: string;
  enabled: boolean;
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTime, setNewTime] = useState("");

  const fetchSchedules = useCallback(async () => {
    const res = await fetch("/api/schedules");
    setSchedules(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Scrape Schedule</CardTitle>
        <CardDescription>
          Configure when WorkGov checks e-GP for new tenders. Times are in
          UTC+7 (Thailand).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
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
                    onCheckedChange={() => toggleSchedule(schedule.id, schedule.enabled)}
                  />
                  <span className="text-sm font-mono font-medium">{schedule.time}</span>
                  <span className="text-xs text-muted-foreground">UTC+7</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeSchedule(schedule.id)}>
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
          <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-[140px]" />
          <Button variant="outline" size="sm" onClick={addSchedule}>
            <Plus className="h-4 w-4 mr-1" />
            Add Time
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
