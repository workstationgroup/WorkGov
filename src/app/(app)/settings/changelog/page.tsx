"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, History } from "lucide-react";

interface ChangelogEntry {
  id: number;
  userName: string | null;
  action: string;
  category: string;
  detail: string;
  createdAt: string;
}

export default function ChangelogPage() {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChangelog = useCallback(async () => {
    const res = await fetch("/api/changelog");
    if (res.ok) setChangelog(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchChangelog(); }, [fetchChangelog]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Changelog</CardTitle>
        <CardDescription>
          Recent changes to settings, keywords, schedules, and security
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : changelog.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No changes recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {changelog.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{entry.detail}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">{entry.category}</Badge>
                    <span className="text-xs text-muted-foreground">{entry.userName || "System"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
