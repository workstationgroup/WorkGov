"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, ChevronRight, Loader2, Building2, Calendar, Banknote } from "lucide-react";
import {
  StatusBadge,
  TypeBadge,
  type TenderStatus,
  type TenderType,
} from "@/components/tenders/status-badge";

interface Tender {
  id: number;
  egpId: string;
  projectName: string;
  agency: string | null;
  province: string | null;
  budget: string | null;
  priceReference: string | null;
  egpStatus: string | null;
  procurementMethod: string | null;
  tenderType: TenderType;
  status: TenderStatus;
  announceDate: string | null;
  submissionDate: string | null;
  matchedKeyword: string | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBudget(value: string | null) {
  if (!value) return "—";
  const num = Number(value);
  if (num >= 1_000_000) return `฿${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `฿${(num / 1_000).toFixed(0)}K`;
  return `฿${num.toLocaleString()}`;
}

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchTenders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);

    const res = await fetch(`/api/tenders?${params}`);
    const data = await res.json();
    setTenders(data);
    setLoading(false);
  }, [searchQuery, typeFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchTenders, 300);
    return () => clearTimeout(timer);
  }, [fetchTenders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Tenders
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and manage government tenders from e-GP
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tenders..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <Select
                value={typeFilter}
                onValueChange={(val) => setTypeFilter(val ?? "all")}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="type_a">Type A — Bid</SelectItem>
                  <SelectItem value="type_b">Type B — Future</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val ?? "all")}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="bidding">Bidding</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tenders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No tenders found
            </p>
          ) : (
            <div className="divide-y">
              {tenders.map((tender) => (
                <Link
                  key={tender.id}
                  href={`/tenders/${tender.egpId}`}
                  className="block py-4 px-2 sm:px-3 -mx-2 sm:-mx-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  {/* Row 1: Title + arrow */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary">
                      {tender.projectName}
                    </h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>

                  {/* Row 2: Agency */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground truncate">
                      {tender.agency || "—"}
                      {tender.province ? ` · ${tender.province}` : ""}
                    </p>
                  </div>

                  {/* Row 3: Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <TypeBadge type={tender.tenderType} />
                    <StatusBadge status={tender.status} />
                    {tender.egpStatus && (
                      <Badge variant="outline" className="text-[10px]">
                        {tender.egpStatus}
                      </Badge>
                    )}
                    {tender.matchedKeyword && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-50 text-slate-600"
                      >
                        {tender.matchedKeyword}
                      </Badge>
                    )}
                  </div>

                  {/* Row 4: Budget + Reference Price */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    <div className="flex items-center gap-1.5">
                      <Banknote className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium">
                        {formatBudget(tender.budget)}
                      </span>
                      {tender.priceReference && (
                        <span className="text-xs text-muted-foreground">
                          (ราคากลาง {formatBudget(tender.priceReference)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 5: Dates */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        ประกาศ {formatDate(tender.announceDate)}
                      </span>
                    </div>
                    {tender.submissionDate && (
                      <span className="text-xs text-muted-foreground">
                        ยื่นซอง {formatDate(tender.submissionDate)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
