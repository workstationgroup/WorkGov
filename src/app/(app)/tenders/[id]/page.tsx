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
  Award,
  Phone,
  Hash,
  ClipboardList,
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
  egpStatus: string | null;
  requiredDocuments:
    | { name: string; date: string | null; category?: string; url?: string }[]
    | null;
  keyPoints: KeyPoints | null;
  winnerName: string | null;
  winnerPrice: string | null;
  winnerTin: string | null;
  bidders: Bidder[] | null;
  winnerCompany: WinnerCompany | null;
  documents: TenderDoc[] | null;
  documentsUpdatedAt: string | null;
  detailUrl: string | null;
  createdAt: string;
}

interface TenderDoc {
  id: number;
  category: string;
  name: string;
  webDate: string | null;
  url: string | null;
  supersededAt: string | null;
}

interface Bidder {
  name: string;
  tin: string;
  price: string | null;
  isWinner: boolean;
}

interface KeyPoints {
  qualifications?: string;
  medianPrice?: string;
  medianPriceSource?: string;
  deliveryTime?: string;
  penalty?: string;
  detailedSpecs?: string;
  specLockNote?: string;
  contactChannel?: string;
}

interface WinnerCompany {
  name: string;
  nameEn: string | null;
  taxId: string | null;
  address: string | null;
  mapUrl: string | null;
  phone: string | null;
  website: string | null;
  businessType: string | null;
  blacklistStatus: string | null;
  dbdStatus: string | null;
  businessObjective: string | null;
  registeredCapital: string | null;
  registerDate: string | null;
  dbdUrl: string | null;
}

const KEY_POINT_LABELS: { key: keyof KeyPoints; label: string }[] = [
  { key: "qualifications", label: "คุณสมบัติผู้เข้าร่วม" },
  { key: "medianPrice", label: "ราคากลาง" },
  { key: "medianPriceSource", label: "ที่มาราคากลาง" },
  { key: "deliveryTime", label: "ระยะเวลาส่งมอบ" },
  { key: "penalty", label: "ค่าปรับ" },
  { key: "detailedSpecs", label: "สเปคสินค้า (ละเอียด)" },
  { key: "specLockNote", label: "ข้อสังเกตการล็อกสเปค" },
  { key: "contactChannel", label: "ช่องทางติดต่อ" },
];

const DOC_CATEGORY_LABELS: Record<string, string> = {
  price_median: "ประกาศราคากลาง",
  tor_bidding: "ร่างเอกสารประกวดราคา (e-bidding)",
  invitation: "ประกาศเชิญชวน",
  bid_summary: "สรุปข้อมูลการเสนอราคาเบื้องต้น",
  winner: "ประกาศรายชื่อผู้ชนะ",
  other: "เอกสารอื่นๆ",
};

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
        {tender.documentsUpdatedAt && (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
          >
            📝 เอกสารอัปเดต {formatDate(tender.documentsUpdatedAt)}
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

          {tender.tenderType === "type_a" && tender.keyPoints && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  ประเด็นสำคัญ (สำหรับยื่นซอง)
                </CardTitle>
                <CardDescription>สรุปจากเอกสารประกวดราคา</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {KEY_POINT_LABELS.map(({ key, label }) => {
                    const value = tender.keyPoints?.[key];
                    if (!value) return null;
                    return (
                      <div key={key}>
                        <dt className="text-sm font-medium">{label}</dt>
                        <dd className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">
                          {value}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </CardContent>
            </Card>
          )}

          {(tender.tenderType === "type_b" || tender.tenderType === "type_c") &&
            (tender.winnerName || tender.winnerCompany) && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    ผู้ชนะการประมูล
                  </CardTitle>
                  <CardDescription>
                    เป้าหมายการขายเฟอร์นิเจอร์
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium">บริษัทผู้ชนะ</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {tender.winnerCompany?.name || tender.winnerName || "—"}
                      </p>
                      {tender.winnerCompany?.nameEn && (
                        <p className="text-xs text-muted-foreground/70">
                          {tender.winnerCompany.nameEn}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tender.winnerCompany?.dbdStatus && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              tender.winnerCompany.dbdStatus.includes("ยังดำเนิน")
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-red-50 text-destructive border-red-200"
                            }`}
                          >
                            {tender.winnerCompany.dbdStatus}
                          </Badge>
                        )}
                        {tender.winnerCompany?.blacklistStatus &&
                          tender.winnerCompany.blacklistStatus !== " " && (
                            <Badge variant="outline" className="bg-red-50 text-destructive border-red-200 text-xs">
                              ⚠ ตรวจสอบ blacklist
                            </Badge>
                          )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">ราคาที่ชนะ</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {tender.winnerPrice
                          ? `฿${Number(tender.winnerPrice).toLocaleString()}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">วันเซ็นสัญญา</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatDate(tender.contractDate)}
                      </p>
                    </div>
                  </div>

                  {tender.winnerCompany ? (
                    <>
                      <Separator />
                      <div className="grid gap-4 sm:grid-cols-2">
                        {tender.winnerCompany.taxId && (
                          <div className="flex items-start gap-3">
                            <Hash className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">เลขผู้เสียภาษี</p>
                              <p className="text-sm text-muted-foreground">
                                {tender.winnerCompany.taxId}
                              </p>
                            </div>
                          </div>
                        )}
                        {tender.winnerCompany.phone && (
                          <div className="flex items-start gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">เบอร์โทร</p>
                              <p className="text-sm text-muted-foreground">
                                {tender.winnerCompany.phone}
                              </p>
                            </div>
                          </div>
                        )}
                        {tender.winnerCompany.businessType && (
                          <div className="flex items-start gap-3">
                            <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">รูปแบบนิติบุคคล</p>
                              <p className="text-sm text-muted-foreground">
                                {tender.winnerCompany.businessType}
                              </p>
                            </div>
                          </div>
                        )}
                        {tender.winnerCompany.businessObjective && (
                          <div className="flex items-start gap-3">
                            <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">ประเภทกิจการ (DBD)</p>
                              <p className="text-sm text-muted-foreground">
                                {tender.winnerCompany.businessObjective}
                              </p>
                            </div>
                          </div>
                        )}
                        {tender.winnerCompany.registeredCapital && (
                          <div className="flex items-start gap-3">
                            <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">ทุนจดทะเบียน</p>
                              <p className="text-sm text-muted-foreground">
                                ฿
                                {Number(
                                  tender.winnerCompany.registeredCapital
                                ).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        )}
                        {tender.winnerCompany.website && (
                          <div className="flex items-start gap-3">
                            <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">เว็บไซต์</p>
                              <a
                                href={`https://${tender.winnerCompany.website.replace(/^https?:\/\//, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-accent break-all"
                              >
                                {tender.winnerCompany.website}
                              </a>
                            </div>
                          </div>
                        )}
                        {tender.winnerCompany.address && (
                          <div className="flex items-start gap-3 sm:col-span-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">ที่อยู่</p>
                              <p className="text-sm text-muted-foreground">
                                {tender.winnerCompany.address}
                              </p>
                              {tender.winnerCompany.mapUrl && (
                                <a
                                  href={tender.winnerCompany.mapUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent inline-flex items-center gap-1 mt-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Google Maps
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {tender.winnerCompany.dbdUrl && (
                        <a
                          href={tender.winnerCompany.dbdUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-accent"
                        >
                          <ExternalLink className="h-4 w-4" />
                          ดูกรรมการ / ข้อมูลเต็มที่ DBD
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      ยังไม่ได้ค้นข้อมูลบริษัทผู้ชนะ
                    </p>
                  )}

                  {tender.bidders && tender.bidders.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium mb-2">
                          สรุปการเสนอราคา ({tender.bidders.length} ราย)
                        </p>
                        <div className="space-y-1.5">
                          {tender.bidders.map((b, i) => (
                            <div
                              key={i}
                              className={`flex items-center justify-between rounded-lg border p-2.5 ${
                                b.isWinner ? "border-emerald-200 bg-emerald-50/50" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {b.isWinner && (
                                  <Award className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                )}
                                <span className="text-sm truncate">{b.name}</span>
                              </div>
                              <span className="text-sm text-muted-foreground shrink-0 ml-2">
                                {b.price
                                  ? `฿${Number(b.price).toLocaleString()}`
                                  : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

          {(() => {
            // Prefer the versioned documents table; fall back to the jsonb
            // snapshot for tenders scraped before versioning existed.
            const docs =
              tender.documents && tender.documents.length > 0
                ? tender.documents.map((d) => ({
                    category: d.category || "other",
                    name: d.name,
                    date: d.webDate,
                    superseded: !!d.supersededAt,
                  }))
                : (tender.requiredDocuments || []).map((d) => ({
                    category: d.category || "other",
                    name: d.name,
                    date: d.date,
                    superseded: false,
                  }));
            if (docs.length === 0) return null;

            const groups = docs.reduce<Record<string, typeof docs>>(
              (acc, doc) => {
                (acc[doc.category] ||= []).push(doc);
                return acc;
              },
              {}
            );

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-lg">
                    เอกสาร/ประกาศที่เกี่ยวข้อง
                  </CardTitle>
                  <CardDescription>
                    จัดกลุ่มตามประเภท — เวอร์ชันก่อนหน้าจะถูกเก็บไว้เปรียบเทียบ
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(groups).map(([cat, list]) => (
                      <div key={cat} className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {DOC_CATEGORY_LABELS[cat] || cat}
                        </p>
                        {list.map((doc, i) => (
                          <div
                            key={i}
                            className={`flex items-center justify-between rounded-lg border p-3 ${
                              doc.superseded ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate">
                                {doc.name}
                              </span>
                              {doc.superseded && (
                                <span className="text-[10px] text-muted-foreground shrink-0 border rounded px-1">
                                  เวอร์ชันก่อนหน้า
                                </span>
                              )}
                            </div>
                            {doc.date && (
                              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                {formatDate(doc.date)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">
                      ดาวน์โหลดเอกสารได้ที่หน้า e-GP โดยตรง
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

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
                href={tender.detailUrl || "https://process5.gprocurement.go.th/egp-agpc01-web/announcement"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!window.confirm("กรุณาเข้าสู่ระบบ e-GP ในอีกหน้าต่างก่อน")) {
                    e.preventDefault();
                  }
                }}
                className="inline-flex items-center justify-center w-full h-8 gap-1.5 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                Open in e-GP
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
