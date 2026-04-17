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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, SlidersHorizontal, ExternalLink, Loader2 } from "lucide-react";
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
  budget: string | null;
  tenderType: TenderType;
  status: TenderStatus;
  submissionDate: string | null;
  matchedKeyword: string | null;
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
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[400px]">Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Submission</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No tenders found
                    </TableCell>
                  </TableRow>
                ) : (
                  tenders.map((tender) => (
                    <TableRow key={tender.id}>
                      <TableCell>
                        <div>
                          <Link
                            href={`/tenders/${tender.id}`}
                            className="text-sm font-medium hover:underline leading-snug"
                          >
                            {tender.projectName}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tender.agency || "—"}
                          </p>
                          {tender.matchedKeyword && (
                            <Badge
                              variant="outline"
                              className="text-[10px] mt-1 bg-slate-50 text-slate-600"
                            >
                              {tender.matchedKeyword}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={tender.tenderType} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tender.status} />
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {tender.budget
                          ? `฿${Number(tender.budget).toLocaleString()}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tender.submissionDate
                          ? new Date(tender.submissionDate).toLocaleDateString(
                              "th-TH"
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/tenders/${tender.id}`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
