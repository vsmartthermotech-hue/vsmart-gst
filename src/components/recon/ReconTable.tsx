import { useMemo, useState } from "react";
import { Search, Flag, ArrowUpDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchStatus, ReconRow, ReconType } from "@/lib/recon-types";

type SortKey = "date" | "amount" | "reference" | "gstin";

const STATUS_BADGE: Record<MatchStatus, string> = {
  matched: "bg-success-bg text-success border border-success/20",
  partial: "bg-warning-bg text-warning-foreground border border-warning/30",
  unmatched: "bg-danger-bg text-danger border border-danger/20",
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  matched: "Matched",
  partial: "Partial",
  unmatched: "Unmatched",
};

export function ReconTable({ rows, reconType = "bank" }: { rows: ReconRow[]; reconType?: ReconType }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(reconType === "gst" ? "gstin" : "date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let r = rows;
    if (q) {
      r = r.filter(
        (x) =>
          x.row.reference.toLowerCase().includes(q) ||
          x.row.dateRaw.toLowerCase().includes(q) ||
          String(x.row.amount).includes(q) ||
          (x.row.gstin?.toLowerCase().includes(q) ?? false) ||
          (x.counterpart?.reference.toLowerCase().includes(q) ?? false) ||
          (x.counterpart?.gstin?.toLowerCase().includes(q) ?? false),
      );
    }
    return [...r].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "date") {
        av = a.row.date?.getTime() ?? 0;
        bv = b.row.date?.getTime() ?? 0;
      } else if (sortKey === "amount") {
        av = a.row.amount;
        bv = b.row.amount;
      } else if (sortKey === "gstin") {
        av = a.row.gstin || "";
        bv = b.row.gstin || "";
      } else {
        av = a.row.reference;
        bv = b.row.reference;
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, query, sortKey, sortDir, reconType]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const toggleFlag = (id: string) =>
    setFlagged((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const formatCurrency = (val?: number) => {
    if (val === undefined) return "—";
    return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={reconType === "gst" ? "Search by GSTIN, Invoice number, amount" : "Search by date, amount, or reference"}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} of {rows.length} rows
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 sticky top-0 z-10">
              {reconType === "gst" ? (
                <tr className="text-left">
                  <SortHeader label="GSTIN" active={sortKey === "gstin"} dir={sortDir} onClick={() => toggleSort("gstin")} />
                  <SortHeader label="Invoice No." active={sortKey === "reference"} dir={sortDir} onClick={() => toggleSort("reference")} />
                  <SortHeader label="Invoice Date" active={sortKey === "date"} dir={sortDir} onClick={() => toggleSort("date")} />
                  <SortHeader label="Taxable Value" active={sortKey === "amount"} dir={sortDir} onClick={() => toggleSort("amount")} align="right" />
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide text-right">
                    Tax breakdown
                  </th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide text-right">
                    Total value
                  </th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Counterpart (Purchase Register)
                  </th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-2.5 w-32"></th>
                </tr>
              ) : (
                <tr className="text-left">
                  <SortHeader label="Date" active={sortKey === "date"} dir={sortDir} onClick={() => toggleSort("date")} />
                  <SortHeader label="Amount" active={sortKey === "amount"} dir={sortDir} onClick={() => toggleSort("amount")} align="right" />
                  <SortHeader label="Reference" active={sortKey === "reference"} dir={sortDir} onClick={() => toggleSort("reference")} />
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Counterpart
                  </th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-2.5 w-32"></th>
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isFlagged = flagged.has(r.row.id);
                
                if (reconType === "gst") {
                  const m = r.gstMismatches;
                  const hasAnyTaxMismatch = m && (m.igst || m.cgst || m.sgst);

                  return (
                    <tr key={r.row.id + r.source} className="border-t hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-foreground font-semibold">
                        {r.row.gstin || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-foreground">
                        {r.row.reference || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-foreground text-xs">
                        {r.row.dateRaw || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums font-medium text-xs">
                        {formatCurrency(r.row.taxableAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] tabular-nums whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-foreground">
                            {formatCurrency(r.row.taxAmount)}
                          </span>
                          <span className="text-muted-foreground text-[10px] mt-0.5">
                            I: <span className={cn(m?.igst && "text-destructive font-semibold")}>{r.row.igst ?? 0}</span> · 
                            C: <span className={cn(m?.cgst && "text-destructive font-semibold")}>{r.row.cgst ?? 0}</span> · 
                            S: <span className={cn(m?.sgst && "text-destructive font-semibold")}>{r.row.sgst ?? 0}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums font-semibold text-xs text-primary">
                        {formatCurrency(r.row.amount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                        {r.counterpart ? (
                          <div>
                            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground">
                              <span>GSTIN: {r.counterpart.gstin}</span>
                              <span className="text-muted-foreground">·</span>
                              <span>Inv: {r.counterpart.reference}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                              <span>Taxable: {formatCurrency(r.counterpart.taxableAmount)}</span>
                              <span>Tax: {formatCurrency(r.counterpart.taxAmount)}</span>
                              <span>Total: {formatCurrency(r.counterpart.amount)}</span>
                            </div>
                            <div className="text-[11px] text-primary/80 font-medium mt-1.5 flex items-center gap-1">
                              {hasAnyTaxMismatch && <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />}
                              <span>{r.reasons.join(" · ")}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="italic">{r.reasons[0] ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs border", STATUS_BADGE[r.status])}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status !== "matched" && (
                          <button
                            onClick={() => toggleFlag(r.row.id)}
                            className={cn(
                              "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors",
                              isFlagged
                                ? "bg-warning-bg border-warning/30 text-warning-foreground"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
                            )}
                          >
                            <Flag className="h-3 w-3" />
                            {isFlagged ? "Flagged" : "Flag"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                } else {
                  return (
                    <tr key={r.row.id + r.source} className="border-t hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-foreground">
                        {r.row.dateRaw || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums font-medium">
                        {formatCurrency(r.row.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-foreground">
                        {r.row.reference || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.counterpart ? (
                          <div>
                            <div className="font-mono">{r.counterpart.reference || "—"}</div>
                            <div className="text-[11px] mt-0.5">{r.reasons.join(" · ")}</div>
                          </div>
                        ) : (
                          <span>{r.reasons[0] ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", STATUS_BADGE[r.status])}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status !== "matched" && (
                          <button
                            onClick={() => toggleFlag(r.row.id)}
                            className={cn(
                              "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors",
                              isFlagged
                                ? "bg-warning-bg border-warning/30 text-warning-foreground"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
                            )}
                          >
                            <Flag className="h-3 w-3" />
                            {isFlagged ? "Flagged" : "Flag"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={reconType === "gst" ? 9 : 6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No rows to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={cn("px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide", align === "right" && "text-right")}>
      <button
        onClick={onClick}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
        {active && <span className="text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
