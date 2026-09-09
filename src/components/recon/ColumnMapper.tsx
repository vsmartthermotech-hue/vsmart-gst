import type { ColumnMap, ReconType } from "@/lib/recon-types";

type Props = {
  title: string;
  columns: string[];
  value: ColumnMap;
  onChange: (m: ColumnMap) => void;
  reconType?: ReconType;
};

const BANK_FIELDS: { key: keyof ColumnMap; label: string; hint: string }[] = [
  { key: "date", label: "Date Column", hint: "Transaction date" },
  { key: "amount", label: "Amount Column", hint: "Transaction amount" },
  { key: "reference", label: "Reference Column", hint: "UTR / Invoice no." },
];

const GST_FIELDS: { key: keyof ColumnMap; label: string; hint: string }[] = [
  { key: "gstin", label: "GSTIN Column", hint: "Supplier GSTIN" },
  { key: "invoiceNumber", label: "Invoice Number Column", hint: "Invoice number" },
  { key: "date", label: "Invoice Date Column (Optional)", hint: "Date of the invoice" },
  { key: "taxableAmount", label: "Taxable Value Column", hint: "Taxable value / amount" },
  { key: "igst", label: "IGST Column (Optional)", hint: "Integrated GST amount" },
  { key: "cgst", label: "CGST Column (Optional)", hint: "Central GST amount" },
  { key: "sgst", label: "SGST Column (Optional)", hint: "State GST amount" },
];

export function ColumnMapper({ title, columns, value, onChange, reconType = "bank" }: Props) {
  const fields = reconType === "gst" ? GST_FIELDS : BANK_FIELDS;

  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {f.label}
            </label>
            <select
              value={value[f.key] || ""}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option value="">Select column...</option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">{f.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ColumnMetrics {
  isNumeric: boolean;
  isGSTIN: boolean;
  isDate: boolean;
  isAlphanumericCode: boolean;
  averageLength: number;
}

function analyzeColumns(columns: string[], rows: any[]): Record<string, ColumnMetrics> {
  const analysis: Record<string, ColumnMetrics> = {};
  const sampleRows = rows.slice(0, 30);
  
  // GSTIN Pattern: 15 characters, alphanumeric. High-confidence regex.
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{3}$/i;
  
  // Date Pattern matcher
  const dateRegex = /^\d{1,4}[-/\s.]\d{1,2}[-/\s.]\d{1,4}/;

  for (const col of columns) {
    const rawVals = sampleRows.map((r) => String(r[col] || "").trim()).filter(Boolean);
    if (rawVals.length === 0) {
      analysis[col] = {
        isNumeric: false,
        isGSTIN: false,
        isDate: false,
        isAlphanumericCode: false,
        averageLength: 0,
      };
      continue;
    }

    let numericCount = 0;
    let gstinCount = 0;
    let dateCount = 0;
    let alphanumericCount = 0;
    let totalLen = 0;

    for (const val of rawVals) {
      totalLen += val.length;

      // 1. GSTIN Check
      const cleanGstin = val.replace(/[^A-Za-z0-9]/g, "");
      if (gstinRegex.test(cleanGstin) && cleanGstin.length === 15) {
        gstinCount++;
      }

      // 2. Date Check
      const looksLikeDate = dateRegex.test(val) || (!isNaN(Date.parse(val)) && isNaN(Number(val)) && val.length > 5);
      if (looksLikeDate) {
        dateCount++;
      }

      // 3. Numeric check
      const cleanNum = val.replace(/[₹\s,]/g, "");
      const parsedNum = Number(cleanNum);
      if (!isNaN(parsedNum) && cleanNum !== "") {
        numericCount++;
      }

      // 4. Alphanumeric/Invoice Code Check
      const hasLetters = /[A-Za-z]/.test(val);
      const hasNumbers = /[0-9]/.test(val);
      const isCode = val.length >= 3 && val.length <= 25 && (hasLetters || hasNumbers);
      if (isCode && !looksLikeDate && !gstinRegex.test(cleanGstin)) {
        alphanumericCount++;
      }
    }

    const len = rawVals.length;
    analysis[col] = {
      isNumeric: numericCount / len >= 0.7,
      isGSTIN: gstinCount / len >= 0.4,
      isDate: dateCount / len >= 0.6,
      isAlphanumericCode: alphanumericCount / len >= 0.4,
      averageLength: totalLen / len,
    };
  }

  return analysis;
}

export function autoMap(columns: string[], rows: any[] = [], reconType: ReconType = "bank"): ColumnMap {
  const metrics = analyzeColumns(columns, rows);
  
  const findBest = (field: keyof ColumnMap) => {
    let bestCol = "";
    let maxScore = -Infinity;

    for (const col of columns) {
      const m = metrics[col];
      const name = col.toLowerCase();
      let score = 0;

      // Dynamic heuristics combining header text matching + cell content signals
      switch (field) {
        case "gstin":
          if (m.isGSTIN) score += 100;
          if (m.isNumeric) score -= 100; // Do not select money amounts for GSTIN
          if (m.isDate) score -= 100;    // Do not select dates for GSTIN
          if (name.includes("gstin") || name.includes("gst/uid") || name.includes("supplier.*gst") || name.includes("gst registration")) score += 60;
          else if (name.includes("gst") && !name.includes("amt") && !name.includes("tax") && !name.includes("rs") && !name.includes("val") && !name.includes("rate")) score += 30;
          break;

        case "invoiceNumber":
        case "reference":
          if (m.isAlphanumericCode) score += 50;
          if (m.isGSTIN) score -= 80;
          if (m.isDate) score -= 80;
          if (m.isNumeric && !name.includes("no") && !name.includes("num")) score -= 30;

          if (name.includes("invoice") || name.includes("inv") || name.includes("bill") || name.includes("doc") || name.includes("voucher") || name.includes("ref") || name.includes("utr")) score += 60;
          if (name.includes("no") || name.includes("num") || name.includes("code")) score += 30;
          break;

        case "date":
          if (m.isDate) score += 100;
          if (m.isNumeric) score -= 80;
          if (name.includes("date") || name.includes("dt")) score += 60;
          if (name.includes("txn") || name.includes("posting")) score += 20;
          break;

        case "taxableAmount":
          if (m.isNumeric) score += 80;
          if (m.isDate || m.isGSTIN) score -= 100;
          if (name.includes("taxable") || name.includes("assessable") || name.includes("base")) score += 60;
          if (name.includes("val") || name.includes("amt") || name.includes("amount")) score += 20;
          // Penalize specific tax breakdown headers to keep taxable separate
          if (name.includes("igst") || name.includes("cgst") || name.includes("sgst") || name.includes("tax")) score -= 50;
          break;

        case "amount":
          if (m.isNumeric) score += 80;
          if (m.isDate || m.isGSTIN) score -= 100;
          if (name.includes("total") || name.includes("amount") || name.includes("amt") || name.includes("value") || name.includes("credit") || name.includes("debit") || name.includes("rs")) score += 50;
          if (name.includes("igst") || name.includes("cgst") || name.includes("sgst")) score -= 40;
          break;

        case "igst":
          if (m.isNumeric) score += 80;
          if (m.isDate || m.isGSTIN) score -= 100;
          if (name.includes("igst")) score += 100;
          if (name.includes("integrated")) score += 50;
          break;

        case "cgst":
          if (m.isNumeric) score += 80;
          if (m.isDate || m.isGSTIN) score -= 100;
          if (name.includes("cgst")) score += 100;
          if (name.includes("central")) score += 50;
          break;

        case "sgst":
          if (m.isNumeric) score += 80;
          if (m.isDate || m.isGSTIN) score -= 100;
          if (name.includes("sgst") || name.includes("utgst")) score += 100;
          if (name.includes("state") || name.includes("union")) score += 50;
          break;
      }

      if (score > maxScore && score > 10) {
        maxScore = score;
        bestCol = col;
      }
    }

    return bestCol;
  };

  if (reconType === "gst") {
    return {
      gstin: findBest("gstin"),
      invoiceNumber: findBest("invoiceNumber"),
      date: findBest("date"),
      taxableAmount: findBest("taxableAmount"),
      igst: findBest("igst"),
      cgst: findBest("cgst"),
      sgst: findBest("sgst"),
    };
  }

  return {
    date: findBest("date"),
    amount: findBest("amount"),
    reference: findBest("reference"),
  };
}
