import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Download,
  ScrollText,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wallet,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FileDropzone } from "@/components/recon/FileDropzone";
import { ColumnMapper, autoMap } from "@/components/recon/ColumnMapper";
import { ReconTable } from "@/components/recon/ReconTable";
import { normalize, normalizeGST, reconcileBank, reconcileGST } from "@/lib/reconcile";
import { exportReport } from "@/lib/export-report";
import type { ParsedFile } from "@/lib/parse-file";
import type { ColumnMap, MatchStatus, ReconRow, ReconType } from "@/lib/recon-types";
import logoUrl from "../logo.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GST & Bank Reconciliation Tool" },
      {
        name: "description",
        content:
          "Reconcile your bank statement and GST ledgers in seconds. Built for accountants.",
      },
      { property: "og:title", content: "GST & Bank Reconciliation Tool" },
      {
        property: "og:description",
        content: "Match bank entries and GST ledgers with smart tolerance engines.",
      },
    ],
  }),
  component: ReconApp,
});

type Step = "upload" | "results";

function ReconApp() {
  const [reconType, setReconType] = useState<ReconType | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [bank, setBank] = useState<ParsedFile | null>(null);
  const [ledger, setLedger] = useState<ParsedFile | null>(null);
  const [bankMap, setBankMap] = useState<ColumnMap>({});
  const [ledgerMap, setLedgerMap] = useState<ColumnMap>({});
  const [results, setResults] = useState<ReconRow[]>([]);

  const handleModeChange = (mode: ReconType | null) => {
    setReconType(mode);
    setBank(null);
    setLedger(null);
    setBankMap({});
    setLedgerMap({});
    setResults([]);
    setStep("upload");
  };

  const handleBank = (f: ParsedFile) => {
    setBank(f);
    setBankMap(autoMap(f.columns, f.rows, reconType || "bank"));
  };
  const handleLedger = (f: ParsedFile) => {
    setLedger(f);
    setLedgerMap(autoMap(f.columns, f.rows, reconType || "bank"));
  };

  const canReconcile = useMemo(() => {
    if (!bank || !ledger) return false;
    if (reconType === "gst") {
      return (
        bankMap.gstin &&
        bankMap.invoiceNumber &&
        bankMap.taxableAmount &&
        ledgerMap.gstin &&
        ledgerMap.invoiceNumber &&
        ledgerMap.taxableAmount
      );
    }
    return (
      bankMap.date &&
      bankMap.amount &&
      bankMap.reference &&
      ledgerMap.date &&
      ledgerMap.amount &&
      ledgerMap.reference
    );
  }, [bank, ledger, bankMap, ledgerMap, reconType]);

  const runReconciliation = () => {
    if (!bank || !ledger || !reconType) return;
    if (reconType === "gst") {
      const b = normalizeGST(bank.rows, bankMap, "G");
      const l = normalizeGST(ledger.rows, ledgerMap, "P");
      setResults(reconcileGST(b, l));
    } else {
      const b = normalize(bank.rows, bankMap, "B");
      const l = normalize(ledger.rows, ledgerMap, "L");
      setResults(reconcileBank(b, l));
    }
    setStep("results");
  };

  const reset = () => {
    setStep("upload");
    setResults([]);
  };

  if (reconType === null) {
    return <SelectionScreen onSelect={handleModeChange} />;
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar
        step={step}
        reconType={reconType}
        onModeChange={handleModeChange}
        onReset={reset}
        hasResults={results.length > 0}
      />

      <main className="flex-1 min-w-0">
        {step === "upload" ? (
          <UploadStep
            reconType={reconType}
            bank={bank}
            ledger={ledger}
            bankMap={bankMap}
            ledgerMap={ledgerMap}
            onBank={handleBank}
            onLedger={handleLedger}
            onClearBank={() => setBank(null)}
            onClearLedger={() => setLedger(null)}
            setBankMap={setBankMap}
            setLedgerMap={setLedgerMap}
            canReconcile={!!canReconcile}
            onRun={runReconciliation}
            onBack={() => handleModeChange(null)}
          />
        ) : (
          <ResultsStep
            reconType={reconType}
            results={results}
            onReset={reset}
          />
        )}
      </main>
    </div>
  );
}

function SelectionScreen({ onSelect }: { onSelect: (m: ReconType) => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background gradients for premium glassmorphism feel */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-success/5 blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-4xl w-full text-center space-y-5 mb-12 animate-fade-in flex flex-col items-center">
        <div className="bg-white p-3 rounded-2xl border shadow-xs inline-flex items-center justify-center max-w-[240px]">
          <img src={logoUrl} alt="MCCIA Logo" className="h-14 md:h-16 w-auto object-contain" />
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-wider uppercase select-none">
          <Sparkles className="h-3.5 w-3.5 text-primary animate-spin" /> MCCIA Reconciliation Studio
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground select-none leading-tight">
          Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-success">ReconBook</span>
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
          Reconcile your GST Registers (GSTR-2B vs Purchase Register) and Bank Statements offline securely in seconds.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full px-2">
        {/* Card 1: GST Reconciliation */}
        <button
          onClick={() => onSelect("gst")}
          className="group relative text-left p-8 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer flex flex-col justify-between h-[300px]"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary/5 to-success/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="space-y-4 relative z-10">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <ScrollText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                GST Reconciliation
              </h3>
              <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                Automated matching between **GSTR-2B** and **Purchase Register**. Map custom GSTIN, invoice numbers, taxable amounts, and flag discrepancies in IGST, CGST, and SGST separately.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:translate-x-1.5 transition-transform relative z-10">
            Launch GST Workspace <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>

        {/* Card 2: Bank Reconciliation */}
        <button
          onClick={() => onSelect("bank")}
          className="group relative text-left p-8 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 cursor-pointer flex flex-col justify-between h-[300px]"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary/5 to-success/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="space-y-4 relative z-10">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                Bank Reconciliation
              </h3>
              <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                Automated matching between **Bank Statement** and **Invoice Register**. Compare Credits with Total Invoices using a smart tolerance window up to ₹500, UTR linkages, and debit exclusion.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:translate-x-1.5 transition-transform relative z-10">
            Launch Bank Workspace <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>
      </div>

      <div className="mt-16 text-center text-[11px] text-muted-foreground select-none max-w-md">
        🔒 All files are parsed locally inside your browser cache. No accounting sheets or invoice numbers are ever sent to any remote servers.
      </div>
    </div>
  );
}

function Sidebar({
  step,
  reconType,
  onModeChange,
  onReset,
  hasResults,
}: {
  step: Step;
  reconType: ReconType;
  onModeChange: (m: ReconType | null) => void;
  onReset: () => void;
  hasResults: boolean;
}) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div
        className="px-5 h-16 flex items-center gap-2 border-b border-sidebar-border cursor-pointer hover:bg-sidebar-accent/50 transition-colors"
        onClick={() => onModeChange(null)}
      >
        <img src={logoUrl} alt="MCCIA Logo" className="h-8 w-8 object-contain rounded-md bg-white p-0.5 border border-sidebar-border" />
        <div>
          <div className="text-sm font-semibold leading-tight">MCCIA Recon</div>
          <div className="text-[11px] text-muted-foreground">Reconciliation Studio</div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Recon Type</div>
        <div className="space-y-1">
          <button
            onClick={() => onModeChange("gst")}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer",
              reconType === "gst"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-sidebar-accent hover:text-foreground"
            )}
          >
            <ScrollText className="h-3.5 w-3.5 shrink-0" /> GST Reconciliation
          </button>
          <button
            onClick={() => onModeChange("bank")}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer",
              reconType === "bank"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-transparent text-muted-foreground border-transparent hover:bg-sidebar-accent hover:text-foreground"
            )}
          >
            <Wallet className="h-3.5 w-3.5 shrink-0" /> Bank Reconciliation
          </button>
        </div>
      </div>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Progress</div>
        <nav className="space-y-1">
          <SidebarStep n={1} label="Upload & Map" active={step === "upload"} done={step === "results"} />
          <SidebarStep n={2} label="Reconciliation" active={step === "results"} done={false} />
        </nav>
      </div>

      <div className="mt-auto p-3 border-t border-sidebar-border">
        {hasResults && (
          <button
            onClick={onReset}
            className="w-full inline-flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-md border border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground cursor-pointer transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        )}
        <p className="text-[11px] text-muted-foreground mt-3 px-1 text-center">
          Files are processed locally in your browser. Nothing is uploaded.
        </p>
      </div>
    </aside>
  );
}

function SidebarStep({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors",
          done
            ? "bg-success text-success-foreground"
            : active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
        )}
      >
        {done ? "✓" : n}
      </span>
      {label}
    </div>
  );
}

function UploadStep(props: {
  reconType: ReconType;
  bank: ParsedFile | null;
  ledger: ParsedFile | null;
  bankMap: ColumnMap;
  ledgerMap: ColumnMap;
  onBank: (f: ParsedFile) => void;
  onLedger: (f: ParsedFile) => void;
  onClearBank: () => void;
  onClearLedger: () => void;
  setBankMap: (m: ColumnMap) => void;
  setLedgerMap: (m: ColumnMap) => void;
  canReconcile: boolean;
  onRun: () => void;
  onBack: () => void;
}) {
  const both = props.bank && props.ledger;
  const isGST = props.reconType === "gst";

  const file1Label = isGST ? "GSTR-2B Register" : "Bank Statement";
  const file1Hint = isGST ? "Export of GSTR-2B (Excel/JSON) from GST portal" : "Exported statement from your bank portal";

  const file2Label = isGST ? "Purchase Register" : "Invoice Register / GST Ledger";
  const file2Hint = isGST ? "Exported purchase ledger from Tally / ERP / books" : "Sales register or GSTR-2B / tally export";

  return (
    <div>
      <header className="h-16 px-8 border-b flex items-center justify-between bg-background sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={props.onBack}
            className="md:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground mr-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2 leading-none">
              {isGST ? "GST Reconciliation Workspace" : "Bank Reconciliation Workspace"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isGST ? "Match GSTR-2B rows against Purchase Register" : "Match Bank Statement rows against Invoice Register"}
            </p>
          </div>
        </div>
        <button
          onClick={props.onBack}
          className="hidden md:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-muted cursor-pointer transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to modes
        </button>
      </header>

      <div className="px-8 py-8 max-w-6xl mx-auto">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold">
              1
            </span>
            <h2 className="text-sm font-bold">Upload files</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <FileDropzone
              label={file1Label}
              hint={file1Hint}
              file={props.bank}
              onParsed={props.onBank}
              onClear={props.onClearBank}
            />
            <FileDropzone
              label={file2Label}
              hint={file2Hint}
              file={props.ledger}
              onParsed={props.onLedger}
              onClear={props.onClearLedger}
            />
          </div>
        </section>

        {both && (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold">
                2
              </span>
              <h2 className="text-sm font-bold">Map columns</h2>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1 ml-1 select-none">
                <Sparkles className="h-3 w-3 animate-pulse" /> Auto-detected — confirm or change
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <ColumnMapper
                title={file1Label}
                columns={props.bank!.columns}
                value={props.bankMap}
                onChange={props.setBankMap}
                reconType={props.reconType}
              />
              <ColumnMapper
                title={file2Label}
                columns={props.ledger!.columns}
                value={props.ledgerMap}
                onChange={props.setLedgerMap}
                reconType={props.reconType}
              />
            </div>
          </section>
        )}

        {both && (
          <section className="mt-10 animate-fade-in">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 flex items-center justify-between flex-wrap gap-4 shadow-xs backdrop-blur-xs">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <ScrollText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">Columns mapped successfully</div>
                  <div className="text-xs text-muted-foreground max-w-xl leading-relaxed mt-0.5">
                    {isGST
                      ? "Smart Matching Engine will verify exact GSTINs + Invoices, apply ±₹2 tolerance limits, and run side-by-side CGST/SGST/IGST breakdown checks."
                      : "Smart Matching Engine will check exact/substring UTR references, apply up to ₹500 tolerances, verify ±5 days dates, and filter out debits."}
                  </div>
                </div>
              </div>
              <button
                disabled={!props.canReconcile}
                onClick={props.onRun}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-all shadow-xs cursor-pointer select-none",
                  props.canReconcile
                    ? "bg-primary text-primary-foreground hover:bg-primary/95 hover:translate-x-0.5 active:scale-98"
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-60",
                )}
              >
                Confirm Mapping & Run <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ResultsStep({
  reconType,
  results,
  onReset,
}: {
  reconType: ReconType;
  results: ReconRow[];
  onReset: () => void;
}) {
  const [tab, setTab] = useState<MatchStatus>("matched");

  const stats = useMemo(() => {
    const groups: Record<MatchStatus, ReconRow[]> = {
      matched: [],
      partial: [],
      unmatched: [],
    };
    for (const r of results) groups[r.status].push(r);
    const sum = (rs: ReconRow[]) => rs.reduce((s, r) => s + r.row.amount, 0);
    return {
      matched: { rows: groups.matched, count: groups.matched.length, total: sum(groups.matched) },
      partial: { rows: groups.partial, count: groups.partial.length, total: sum(groups.partial) },
      unmatched: { rows: groups.unmatched, count: groups.unmatched.length, total: sum(groups.unmatched) },
    };
  }, [results]);

  const current = stats[tab].rows;

  return (
    <div>
      <header className="h-16 px-8 border-b flex items-center justify-between bg-background sticky top-0 z-20">
        <div>
          <h1 className="text-base font-bold">
            {reconType === "gst" ? "GST Reconciliation Results" : "Bank Reconciliation Results"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {results.length} total register entries analyzed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 text-sm px-3.5 py-2 rounded-md border hover:bg-muted cursor-pointer transition-colors"
          >
            <RotateCcw className="h-4 w-4" /> Start over
          </button>
          <button
            onClick={() => exportReport(results, reconType)}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-semibold cursor-pointer transition-colors shadow-xs"
          >
            <Download className="h-4 w-4" /> Download Report
          </button>
        </div>
      </header>

      <div className="px-8 py-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            tone="success"
            label="Matched"
            count={stats.matched.count}
            total={stats.matched.total}
            icon={<CheckCircle2 className="h-4 w-4" />}
            active={tab === "matched"}
            onClick={() => setTab("matched")}
          />
          <StatCard
            tone="warning"
            label="Partial Match"
            count={stats.partial.count}
            total={stats.partial.total}
            icon={<AlertTriangle className="h-4 w-4" />}
            active={tab === "partial"}
            onClick={() => setTab("partial")}
          />
          <StatCard
            tone="danger"
            label="Unmatched"
            count={stats.unmatched.count}
            total={stats.unmatched.total}
            icon={<XCircle className="h-4 w-4" />}
            active={tab === "unmatched"}
            onClick={() => setTab("unmatched")}
          />
        </div>

        <div className="mt-6">
          <div className="flex items-center border-b mb-4">
            {(["matched", "partial", "unmatched"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors cursor-pointer select-none",
                  tab === t
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "matched" ? "Matched" : t === "partial" ? "Partial Match" : "Unmatched"}
                <span className="ml-2 text-xs text-muted-foreground font-semibold bg-muted px-1.5 py-0.5 rounded-md">{stats[t].count}</span>
              </button>
            ))}
          </div>

          <ReconTable rows={current} reconType={reconType} />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  tone,
  label,
  count,
  total,
  icon,
  active,
  onClick,
}: {
  tone: "success" | "warning" | "danger";
  label: string;
  count: number;
  total: number;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  const toneClasses = {
    success: { dot: "bg-success", text: "text-success", bg: "bg-success-bg" },
    warning: { dot: "bg-warning", text: "text-warning-foreground", bg: "bg-warning-bg" },
    danger: { dot: "bg-danger", text: "text-danger", bg: "bg-danger-bg" },
  }[tone];

  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border bg-card p-5 transition-all hover:shadow-sm cursor-pointer",
        active ? "ring-2 ring-foreground/10 border-foreground/20" : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-7 w-7 rounded-md flex items-center justify-center", toneClasses.bg, toneClasses.text)}>
            {icon}
          </span>
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <span className={cn("h-2 w-2 rounded-full", toneClasses.dot)} />
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold tabular-nums leading-tight">{count}</div>
        <div className="text-xs text-muted-foreground mt-1 tabular-nums">
          ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </button>
  );
}
