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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Loader2, Ban } from "lucide-react";

interface Keyword {
  id: number;
  keyword: string;
  type: string;
  enabled: boolean;
}

export default function ExclusionsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");

  const fetchKeywords = useCallback(async () => {
    const res = await fetch("/api/keywords");
    const data = await res.json();
    setKeywords(data.filter((k: Keyword) => k.type === "negative"));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  async function addKeyword() {
    if (!newKeyword.trim()) return;
    const res = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: newKeyword.trim(), type: "negative" }),
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
          Exclusions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tenders containing these words will be hidden from all lists
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Negative Keywords</CardTitle>
          <CardDescription>
            If a tender's project name contains any of these words, it will not
            appear in your tenders list and will be skipped during scraping.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {keywords.map((kw) => (
                <div
                  key={kw.id}
                  className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={kw.enabled}
                      onCheckedChange={() => toggleKeyword(kw.id, kw.enabled)}
                    />
                    <Ban className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-sm font-medium">{kw.keyword}</span>
                    <Badge
                      variant="outline"
                      className="bg-red-100 text-red-800 border-red-200 text-[10px]"
                    >
                      Exclude
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
                  No negative keywords yet. Add words below to exclude matching
                  tenders.
                </p>
              )}
            </div>
          )}
          <Separator />
          <div className="flex items-center gap-2">
            <Input
              placeholder="Exclude tenders containing..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") addKeyword();
              }}
            />
            <Button variant="outline" size="sm" onClick={addKeyword}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
