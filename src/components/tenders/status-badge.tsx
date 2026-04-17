import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TenderStatus =
  | "new"
  | "reviewing"
  | "bidding"
  | "won"
  | "lost"
  | "skipped";

export type TenderType = "type_a" | "type_b" | "irrelevant";

const statusConfig: Record<
  TenderStatus,
  { label: string; className: string }
> = {
  new: {
    label: "New",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  reviewing: {
    label: "Reviewing",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  bidding: {
    label: "Bidding",
    className: "bg-violet-100 text-violet-800 border-violet-200",
  },
  won: {
    label: "Won",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  lost: {
    label: "Lost",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
  skipped: {
    label: "Skipped",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

const typeConfig: Record<TenderType, { label: string; className: string }> = {
  type_a: {
    label: "Type A — Bid Now",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
  type_b: {
    label: "Type B — Future",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  irrelevant: {
    label: "Irrelevant",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

export function StatusBadge({ status }: { status: TenderStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}

export function TypeBadge({ type }: { type: TenderType }) {
  const config = typeConfig[type];
  return (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}
