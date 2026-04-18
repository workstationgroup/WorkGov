"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Bell,
  Play,
  Loader2,
} from "lucide-react";

interface DashboardData {
  stats: {
    total: number;
    newToday: number;
    activeBids: number;
    deadlineSoon: number;
  };
  recentTenders: {
    id: number;
    egpId: string;
    projectName: string;
    agency: string | null;
    tenderType: string;
    status: string;
    budget: string | null;
    submissionDate: string | null;
  }[];
  latestScrape: {
    startedAt: string;
    finishedAt: string | null;
    status: string;
    tendersFound: number | null;
    tendersNew: number | null;
    errorMessage: string | null;
  } | null;
  schedules: string[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    const res = await fetch("/api/dashboard");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  async function handleManualScrape() {
    setScraping(true);
    setScrapeMessage(null);
    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setScrapeMessage(
          `Found ${json.tenders_found} tenders, ${json.tenders_new} new${json.line_sent ? " (LINE sent)" : ""}`
        );
        fetchDashboard();
      } else {
        setScrapeMessage(`Error: ${json.error}`);
      }
    } catch {
      setScrapeMessage("Network error");
    } finally {
      setScraping(false);
    }
  }

  const stats = [
    {
      title: "Total Tenders",
      value: data?.stats.total ?? "—",
      description: "All tracked tenders",
      icon: FileText,
      color: "text-sky-600",
    },
    {
      title: "New Today",
      value: data?.stats.newToday ?? "—",
      description: "Pending review",
      icon: Bell,
      color: "text-amber-600",
    },
    {
      title: "Active Bids",
      value: data?.stats.activeBids ?? "—",
      description: "Currently bidding",
      icon: TrendingUp,
      color: "text-violet-600",
    },
    {
      title: "Deadline Soon",
      value: data?.stats.deadlineSoon ?? "—",
      description: "Within 7 days",
      icon: AlertTriangle,
      color: "text-red-600",
    },
  ];

  function formatScrapeTime(dateStr: string | null | undefined) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function getNextRun(schedulesList: string[] | undefined) {
    if (!schedulesList || schedulesList.length === 0) return "Configure in Settings";
    const now = new Date();
    const utc7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const currentTime = utc7.toISOString().slice(11, 16);
    const next = schedulesList.find((t) => t > currentTime) || schedulesList[0];
    return `${next} UTC+7`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of government tender activity
          </p>
        </div>
        <Button
          onClick={handleManualScrape}
          disabled={scraping}
          className="gap-2"
        >
          {scraping ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {scraping ? "Scraping..." : "Run Scrape Now"}
        </Button>
      </div>

      {scrapeMessage && (
        <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm">
          {scrapeMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading">
                {loading ? "—" : stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              Recent Tenders
            </CardTitle>
            <CardDescription>Latest tenders from e-GP</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : data && data.recentTenders.length > 0 ? (
                data.recentTenders.map((tender) => (
                  <Link
                    key={tender.id}
                    href={`/tenders/${tender.egpId}`}
                    className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-mono font-bold text-accent">
                        {tender.egpId}
                      </p>
                      <p className="text-sm font-medium leading-snug truncate">
                        {tender.projectName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tender.agency || "—"}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className={
                            tender.tenderType === "type_a"
                              ? "bg-sky-100 text-sky-800 border-sky-200 text-xs"
                              : "bg-amber-100 text-amber-800 border-amber-200 text-xs"
                          }
                        >
                          {tender.tenderType === "type_a" ? "Type A" : "Type B"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-blue-100 text-blue-800 border-blue-200 text-xs"
                        >
                          {tender.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {tender.budget
                          ? `฿${Number(tender.budget).toLocaleString()}`
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tender.submissionDate
                          ? new Date(tender.submissionDate).toLocaleDateString(
                              "th-TH"
                            )
                          : "—"}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No tenders yet — click &quot;Run Scrape Now&quot; or wait for
                  the scheduled run
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              Scrape Status
            </CardTitle>
            <CardDescription>e-GP monitoring activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Last Run</p>
                  <p className="text-xs text-muted-foreground">
                    {formatScrapeTime(data?.latestScrape?.startedAt)}
                    {data?.latestScrape?.status === "error" && (
                      <span className="text-red-500 ml-1">(error)</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Next Run</p>
                  <p className="text-xs text-muted-foreground">
                    {getNextRun(data?.schedules)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Last Result</p>
                  <p className="text-xs text-muted-foreground">
                    {data?.latestScrape
                      ? `Found ${data.latestScrape.tendersFound ?? 0}, New ${data.latestScrape.tendersNew ?? 0}`
                      : "No runs yet"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
