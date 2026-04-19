"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface Keyword {
  id: number;
  keyword: string;
  type: string;
  enabled: boolean;
}

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [newType, setNewType] = useState<"type_a" | "type_b">("type_a");

  const fetchKeywords = useCallback(async () => {
    const res = await fetch("/api/keywords");
    const data = await res.json();
    setKeywords(data.filter((k: Keyword) => k.type !== "negative"));
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeywords(); }, [fetchKeywords]);

  async function addKeyword() {
    if (!newKeyword) return;
    const res = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: newKeyword, type: newType }),
    });
    if (res.ok) {
      const created = await res.json();
      setKeywords((prev) => [...prev, created]);
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
    setKeywords((prev) => prev.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Search Keywords</CardTitle>
        <CardDescription>
          Keywords used to search for relevant tenders on e-GP. Type A for
          direct bidding, Type B for future opportunities.
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
              <div key={kw.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Switch checked={kw.enabled} onCheckedChange={() => toggleKeyword(kw.id, kw.enabled)} />
                  <span className="text-sm font-medium">{kw.keyword}</span>
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
                <Button variant="ghost" size="icon" onClick={() => removeKeyword(kw.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            {keywords.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No search keywords configured. Add one below.
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
            onKeyDown={(e) => { if (e.key === "Enter") addKeyword(); }}
          />
          <div className="flex items-center gap-1">
            <Button variant={newType === "type_a" ? "default" : "outline"} size="sm" onClick={() => setNewType("type_a")}>A</Button>
            <Button variant={newType === "type_b" ? "default" : "outline"} size="sm" onClick={() => setNewType("type_b")}>B</Button>
          </div>
          <Button variant="outline" size="sm" onClick={addKeyword}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
