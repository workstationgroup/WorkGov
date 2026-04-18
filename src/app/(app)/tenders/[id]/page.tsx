"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  MapPin,
  ExternalLink,
  Loader2,
} from "lucide-react";
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
  subAgency: string | null;
  province: string | null;
  budget: string | null;
  priceReference: string | null;
  procurementMethod: string | null;
  tenderType: TenderType;
  status: TenderStatus;
  aiSummary: string | null;
  aiClassificationReason: string | null;
  scopeOfWork: string | null;
  matchedKeyword: string | null;
  announceDate: string | null;
  documentStartDate: string | null;
  documentEndDate: string | null;
  siteVisitDate: string | null;
  submissionDate: string | null;
  openingDate: string | null;
  resultDate: string | null;
  contractDate: string | null;
  detailUrl: string | null;
  createdAt: string;
}

const METHOD_MAP: Record<string, string> = {
  "15": "ประกวดราคา",
  "16": "e-bidding",
  "17": "คัดเลือก",
  "19": "เฉพาะเจาะจง",
  "20": "จ้างที่ปรึกษา",
  "21": "จ้างออกแบบ",
};

function formatMethod(value: string | null) {
  if (!value) return "—";
  return METHOD_MAP[value] || value;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TenderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchTender = useCallback(async () => {
    const res = await fetch(`/api/tenders/${id}`);
    if (res.ok) {
      setTender(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchTender();
  }, [fetchTender]);

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    const res = await fetch(`/api/tenders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setTender(await res.json());
    }
    setUpdating(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tender) {
    return (
      <div className="space-y-4">
        <Link
          href="/tenders"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tenders
        </Link>
        <p className="text-muted-foreground">Tender not found.</p>
      </div>
    );
  }

  const timelineSteps = [
    { label: "ประกาศ", sublabel: "Announced", date: formatDate(tender.announceDate), done: !!tender.announceDate },
    { label: "ขายเอกสาร", sublabel: "Document sale", date: tender.documentStartDate ? `${formatDate(tender.documentStartDate)} — ${formatDate(tender.documentEndDate)}` : "—", done: !!tender.documentStartDate },
    { label: "ดูสถานที่", sublabel: "Site visit", date: formatDate(tender.siteVisitDate), done: !!tender.siteVisitDate },
    { label: "ยื่นซอง", sublabel: "Submit bid", date: formatDate(tender.submissionDate), done: !!tender.submissionDate },
    { label: "เปิดซอง", sublabel: "Bid opening", date: formatDate(tender.openingDate), done: !!tender.openingDate },
    { label: "ประกาศผล", sublabel: "Result", date: formatDate(tender.resultDate), done: !!tender.resultDate },
    { label: "ลงนามสัญญา", sublabel: "Contract", date: formatDate(tender.contractDate), done: !!tender.contractDate },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/tenders"
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Tender Detail
          </h1>
          <p className="text-lg font-mono font-bold text-accent mt-0.5">
            {tender.egpId}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <TypeBadge type={tender.tenderType} />
        <StatusBadge status={tender.status} />
        {tender.matchedKeyword && (
          <Badge
            variant="outline"
            className="bg-slate-50 text-slate-600 text-xs"
          >
            {tender.matchedKeyword}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">
                Project Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Project Name</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {tender.projectName}
                </p>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Agency</p>
                    <p className="text-sm text-muted-foreground">
                      {tender.agency || "—"}
                    </p>
                    {tender.subAgency && (
                      <p className="text-xs text-muted-foreground">
                        {tender.subAgency}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Province</p>
                    <p className="text-sm text-muted-foreground">
                      {tender.province || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Budget</p>
                    <p className="text-sm text-muted-foreground">
                      {tender.budget
                        ? `฿${Number(tender.budget).toLocaleString()}`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Procurement Method</p>
                    <p className="text-sm text-muted-foreground">
                      {formatMethod(tender.procurementMethod)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">
                AI Summary
              </CardTitle>
              <CardDescription>Analysis by Claude AI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                {tender.aiSummary ? (
                  <>
                    <p className="text-sm">{tender.aiSummary}</p>
                    {tender.aiClassificationReason && (
                      <p className="text-xs text-muted-foreground">
                        Classification reason: {tender.aiClassificationReason}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    AI summary will appear after the scraper processes this tender.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {tender.scopeOfWork && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Scope of Work
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{tender.scopeOfWork}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {timelineSteps.map((step) => (
                <div key={step.label} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        step.done
                          ? "bg-accent"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                    <span className="text-xs font-medium">{step.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{step.date}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tender.status !== "reviewing" && (
                <Button
                  className="w-full"
                  variant="default"
                  disabled={updating}
                  onClick={() => updateStatus("reviewing")}
                >
                  Mark as Reviewing
                </Button>
              )}
              {tender.status !== "bidding" && (
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={updating}
                  onClick={() => updateStatus("bidding")}
                >
                  Mark as Bidding
                </Button>
              )}
              {tender.status === "bidding" && (
                <>
                  <Button
                    className="w-full"
                    variant="default"
                    disabled={updating}
                    onClick={() => updateStatus("won")}
                  >
                    Mark as Won
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={updating}
                    onClick={() => updateStatus("lost")}
                  >
                    Mark as Lost
                  </Button>
                </>
              )}
              <a
                href="https://process5.gprocurement.go.th/egp-agpc01-web/announcement"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!window.confirm("กรุณาเข้าสู่ระบบ e-GP ในอีกหน้าต่างก่อน แล้วจึงกดค้นหาด้วยเลข e-GP ID")) {
                    e.preventDefault();
                  }
                }}
                className="inline-flex items-center justify-center w-full h-8 gap-1.5 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                Search in e-GP
              </a>
              <Separator className="my-2" />
              {tender.status !== "skipped" ? (
                <Button
                  className="w-full"
                  variant="ghost"
                  disabled={updating}
                  onClick={() => updateStatus("skipped")}
                >
                  Skip Tender
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="ghost"
                  disabled={updating}
                  onClick={() => updateStatus("new")}
                >
                  Reopen Tender
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
