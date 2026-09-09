import type { ColumnMap, NormalizedRow, RawRow, ReconRow } from "./recon-types";

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
};

export function normalize(rows: RawRow[], map: ColumnMap, prefix: string): NormalizedRow[] {
  const result: NormalizedRow[] = [];
  let idx = 0;
  
  for (const r of rows) {
    const cleaned = trimAllCells(r);
    // Skip entirely blank or null rows
    if (!cleaned) continue;

    // Use exact columns if present, otherwise fallback to the mapped keys
    let dateVal = cleaned[map.date || ""];
    let amountVal = cleaned[map.amount || ""];
    let refVal = cleaned[map.reference || ""];

    if (prefix === "B") {
      // Bank Statement exact columns: "Date", "Credit (Rs.)", "UTR / Reference No."
      if (cleaned["Date"] !== undefined) dateVal = cleaned["Date"];
      if (cleaned["Credit (Rs.)"] !== undefined) amountVal = cleaned["Credit (Rs.)"];
      if (cleaned["UTR / Reference No."] !== undefined) refVal = cleaned["UTR / Reference No."];

      const parsedAmt = parseAmount(amountVal);
      // Skip any bank row where Credit (Rs.) is empty, null, or zero
      if (!amountVal || parsedAmt === 0) {
        continue;
      }

      // Also ignore bank charge rows and GST payment rows (debit entries)
      const rawText = Object.values(cleaned).join(" ").toLowerCase();
      if (
        rawText.includes("bank charge") ||
        rawText.includes("bank charges") ||
        rawText.includes("gst payment") ||
        rawText.includes("gst payments") ||
        rawText.includes("gst paid") ||
        (rawText.includes("charge") && !rawText.includes("discharge")) ||
        rawText.includes("debit entry") ||
        rawText.includes("payment") ||
        rawText.includes("fees")
      ) {
        continue;
      }
    } else {
      // Invoice Register exact columns: "Invoice Date", "Total Amount (Rs.)", "Invoice No."
      if (cleaned["Invoice Date"] !== undefined) dateVal = cleaned["Invoice Date"];
      if (cleaned["Total Amount (Rs.)"] !== undefined) amountVal = cleaned["Total Amount (Rs.)"];
      if (cleaned["Invoice No."] !== undefined) refVal = cleaned["Invoice No."];
    }

    // If Date, Amount, and Reference mapped cells are all blank, skip
    if (!dateVal && !amountVal && !refVal) {
      continue;
    }

    const dateObj = parseDate(dateVal);
    const amountNum = parseAmount(amountVal);
    
    // Standardize all dates to DD-MM-YYYY format
    const formattedDate = formatDateToDDMMYYYY(dateObj) || String(dateVal || "").trim();

    result.push({
      id: `${prefix}-${idx++}`,
      date: dateObj,
      dateRaw: formattedDate,
      amount: amountNum,
      reference: normalizeRef(refVal),
      raw: cleaned,
    });
  }
  
  return result;
}

function trimAllCells(row: RawRow): RawRow | null {
  if (!row) return null;
  const cleaned: RawRow = {};
  let hasContent = false;
  
  for (const [key, val] of Object.entries(row)) {
    if (val !== null && val !== undefined) {
      // Trim extra spaces
      const valStr = String(val).trim().replace(/\s+/g, " ");
      cleaned[key] = valStr;
      if (valStr !== "") {
        hasContent = true;
      }
    } else {
      cleaned[key] = "";
    }
  }
  
  return hasContent ? cleaned : null;
}

function parseAmount(v: unknown): number {
  if (typeof v === "number") return Math.abs(v);
  if (v == null) return 0;
  // Remove commas, currency symbols, and spaces, then convert to numbers
  const s = String(v).replace(/,/g, "").replace(/[₹$,\s]/g, "").replace(/[()]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial date number
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (!s) return null;
  
  // Split by whitespace or T to isolate the date part and drop time/timezone suffixes
  const datePart = s.split(/[\sT]+/)[0];
  
  // Parse format by splitting by "-" or "/"
  const parts = datePart.split(/[\-\/]/);
  if (parts.length === 3) {
    const p1 = parts[0];
    const p2 = parts[1];
    const p3 = parts[2];
    
    if (p3.length === 4) {
      // DD-MM-YYYY or MM-DD-YYYY
      const dd = parseInt(p1);
      const mm = parseInt(p2);
      const yyyy = parseInt(p3);
      
      // If second part > 12, it must be MM-DD-YYYY
      if (mm > 12) {
        const dt = new Date(yyyy, dd - 1, mm);
        if (!isNaN(dt.getTime())) return dt;
      } else {
        // Default DD-MM-YYYY
        const dt = new Date(yyyy, mm - 1, dd);
        if (!isNaN(dt.getTime())) return dt;
      }
    } else if (p1.length === 4) {
      // YYYY-MM-DD
      const yyyy = parseInt(p1);
      const mm = parseInt(p2);
      const dd = parseInt(p3);
      const dt = new Date(yyyy, mm - 1, dd);
      if (!isNaN(dt.getTime())) return dt;
    }
  }
  
  const dt = new Date(s);
  if (isNaN(dt.getTime())) {
    console.warn("Reconcile: Failed to parse date string:", v);
    return null;
  }
  return dt;
}

function formatDateToDDMMYYYY(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function normalizeRef(v: unknown): string {
  if (v == null) return "";
  return String(v).trim().toUpperCase().replace(/[\s\-_]/g, "");
}

function isRefMatch(ref1: string, ref2: string): boolean {
  if (!ref1 || !ref2) return false;
  if (ref1 === ref2) return true;
  // Substring match requires length >= 4 to avoid generic matches on strings like "REF", "INV", etc.
  if (ref1.length >= 4 && ref2.length >= 4) {
    if (ref1.includes(ref2) || ref2.includes(ref1)) {
      return true;
    }
  }
  return false;
}

export function normalizeGST(rows: RawRow[], map: ColumnMap, prefix: string): NormalizedRow[] {
  const result: NormalizedRow[] = [];
  let idx = 0;
  
  for (const r of rows) {
    const cleaned = trimAllCells(r);
    // Skip entirely blank or null rows
    if (!cleaned) continue;

    const gstinVal = cleaned[map.gstin || ""];
    const invNumVal = cleaned[map.invoiceNumber || ""];
    const dateVal = cleaned[map.date || ""];
    const taxableVal = cleaned[map.taxableAmount || ""];
    const igstVal = cleaned[map.igst || ""];
    const cgstVal = cleaned[map.cgst || ""];
    const sgstVal = cleaned[map.sgst || ""];

    // If GSTIN, Invoice Number, and Taxable mapped cells are all blank, skip
    if (!gstinVal && !invNumVal && !taxableVal) {
      continue;
    }

    const dateObj = parseDate(dateVal);
    const taxableAmt = parseAmount(taxableVal);
    const igstAmt = parseAmount(igstVal);
    const cgstAmt = parseAmount(cgstVal);
    const sgstAmt = parseAmount(sgstVal);
    const taxAmt = igstAmt + cgstAmt + sgstAmt;
    const totalAmt = taxableAmt + taxAmt;
    
    // Standardize all dates to DD-MM-YYYY format
    const formattedDate = formatDateToDDMMYYYY(dateObj) || String(dateVal || "").trim();

    result.push({
      id: `${prefix}-${idx++}`,
      date: dateObj,
      dateRaw: formattedDate,
      amount: totalAmt,
      reference: normalizeRef(invNumVal),
      raw: cleaned,
      gstin: String(gstinVal || "").trim().toUpperCase(),
      invoiceNumber: normalizeRef(invNumVal),
      taxableAmount: taxableAmt,
      igst: igstAmt,
      cgst: cgstAmt,
      sgst: sgstAmt,
      taxAmount: taxAmt
    });
  }
  
  return result;
}

function isInvoiceMatch(inv1: string, inv2: string): boolean {
  if (!inv1 || !inv2) return false;
  const n1 = inv1.replace(/[^A-Z0-9]/gi, "");
  const n2 = inv2.replace(/[^A-Z0-9]/gi, "");
  if (n1 === n2) return true;
  // Support matching if one contains the other and length >= 4
  if (n1.length >= 4 && n2.length >= 4) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }
  return false;
}

export function reconcileGST(gstr: NormalizedRow[], purchase: NormalizedRow[]): ReconRow[] {
  const purchaseTaken = new Set<string>();
  const results: ReconRow[] = [];

  console.log(`--- Starting GST Reconciliation: GSTR-2B Rows (${gstr.length}), Purchase Rows (${purchase.length}) ---`);

  // Step 1: First match by GSTIN + Invoice Number only
  for (const g of gstr) {
    if (!g.gstin || !g.invoiceNumber) continue;

    let bestPurchase: NormalizedRow | null = null;
    let minDiff = Infinity;

    for (const p of purchase) {
      if (purchaseTaken.has(p.id)) continue;
      if (!p.gstin || !p.invoiceNumber) continue;

      if (g.gstin === p.gstin && isInvoiceMatch(g.invoiceNumber, p.invoiceNumber)) {
        const taxableDiff = Math.abs((g.taxableAmount ?? 0) - (p.taxableAmount ?? 0));
        const taxDiff = Math.abs((g.taxAmount ?? 0) - (p.taxAmount ?? 0));
        const totalDiff = taxableDiff + taxDiff;

        if (totalDiff < minDiff) {
          minDiff = totalDiff;
          bestPurchase = p;
        }
      }
    }

    // Step 2: If GSTIN + Invoice Number found in both files then check amounts
    if (bestPurchase) {
      purchaseTaken.add(bestPurchase.id);

      const taxableDiff = Math.abs((g.taxableAmount ?? 0) - (bestPurchase.taxableAmount ?? 0));
      const igstDiff = Math.abs((g.igst ?? 0) - (bestPurchase.igst ?? 0));
      const cgstDiff = Math.abs((g.cgst ?? 0) - (bestPurchase.cgst ?? 0));
      const sgstDiff = Math.abs((g.sgst ?? 0) - (bestPurchase.sgst ?? 0));
      const taxDiff = Math.abs((g.taxAmount ?? 0) - (bestPurchase.taxAmount ?? 0));

      const isMatched = taxableDiff <= 2 && igstDiff <= 2 && cgstDiff <= 2 && sgstDiff <= 2;
      const status = isMatched ? "matched" : "partial";

      const reasons: string[] = ["GSTIN & Invoice No. match"];
      if (isMatched) {
        reasons.push("Amounts match (diff <= ₹2)");
      } else {
        if (taxableDiff > 2) reasons.push(`Taxable Diff ₹${taxableDiff.toFixed(2)}`);
        if (taxDiff > 2) reasons.push(`Tax Diff ₹${taxDiff.toFixed(2)}`);
      }

      const gstMismatches = {
        igst: igstDiff > 2,
        cgst: cgstDiff > 2,
        sgst: sgstDiff > 2
      };

      if (gstMismatches.igst) reasons.push(`IGST Mismatch: GSTR ₹${g.igst} vs PR ₹${bestPurchase.igst}`);
      if (gstMismatches.cgst) reasons.push(`CGST Mismatch: GSTR ₹${g.cgst} vs PR ₹${bestPurchase.cgst}`);
      if (gstMismatches.sgst) reasons.push(`SGST Mismatch: GSTR ₹${g.sgst} vs PR ₹${bestPurchase.sgst}`);

      results.push({
        source: "bank",
        row: g,
        counterpart: bestPurchase,
        status,
        reasons,
        gstMismatches
      });
    }
  }

  // Step 3: If GSTIN + Invoice Number not found in other file at all -> Unmatched
  for (const g of gstr) {
    if (results.some(r => r.row.id === g.id)) continue;
    results.push({
      source: "bank",
      row: g,
      status: "unmatched",
      reasons: ["No matching invoice found in Purchase Register"],
    });
  }

  for (const p of purchase) {
    if (purchaseTaken.has(p.id)) continue;
    results.push({
      source: "ledger",
      row: p,
      status: "unmatched",
      reasons: ["No matching invoice found in GSTR-2B"],
    });
  }

  return results;
}

export function reconcileBank(bank: NormalizedRow[], ledger: NormalizedRow[]): ReconRow[] {
  const ledgerTaken = new Set<string>();
  const results: ReconRow[] = [];

  console.log(`--- Starting Bank Reconciliation: Bank Rows (${bank.length}), Ledger Rows (${ledger.length}) ---`);

  // Pass 1: Match by UTR / Reference number if available (with score tracking)
  for (const b of bank) {
    if (!b.reference) continue;

    let bestLedger: NormalizedRow | null = null;
    let minScore = Infinity;

    for (const l of ledger) {
      if (ledgerTaken.has(l.id)) continue;
      if (!l.reference) continue;

      if (isRefMatch(b.reference, l.reference)) {
        const amountDiff = Math.abs(b.amount - l.amount);
        const dateDiffDays = b.date && l.date ? Math.abs(b.date.getTime() - l.date.getTime()) / DAY_MS : 50;
        
        const score = amountDiff + (dateDiffDays * 0.1);
        if (score < minScore) {
          minScore = score;
          bestLedger = l;
        }
      }
    }

    if (bestLedger) {
      ledgerTaken.add(bestLedger.id);
      
      const amountDiff = Math.abs(b.amount - bestLedger.amount);
      const dateDiffDays = b.date && bestLedger.date ? Math.abs(b.date.getTime() - bestLedger.date.getTime()) / DAY_MS : null;
      
      const reasons = ["Reference match"];
      if (amountDiff <= 2) {
        reasons.push("Amount matches");
      } else {
        reasons.push(`Amount diff ₹${amountDiff.toFixed(2)}`);
      }
      if (dateDiffDays !== null) {
        reasons.push(`Date diff ${Math.round(dateDiffDays)}d`);
      }

      results.push({
        source: "bank",
        row: b,
        counterpart: bestLedger,
        status: amountDiff <= 2 ? "matched" : amountDiff <= 500 ? "partial" : "unmatched",
        reasons,
      });
    }
  }

  // Pass 2: Match by Amount and Date (within 5 days, amount difference <= ₹2 (Matched) or ₹2 to ₹500 (Partial))
  for (const b of bank) {
    if (results.some((r) => r.row.id === b.id)) continue;

    let bestLedger: NormalizedRow | null = null;
    let minScore = Infinity;

    for (const l of ledger) {
      if (ledgerTaken.has(l.id)) continue;

      const amountDiff = Math.abs(b.amount - l.amount);
      const dateDiffDays = b.date && l.date ? Math.abs(b.date.getTime() - l.date.getTime()) / DAY_MS : null;

      const isEligible = dateDiffDays !== null && dateDiffDays <= 5 && amountDiff <= 500;

      if (isEligible) {
        const score = amountDiff + (dateDiffDays * 0.1);
        if (score < minScore) {
          minScore = score;
          bestLedger = l;
        }
      }
    }

    if (bestLedger) {
      ledgerTaken.add(bestLedger.id);
      
      const amountDiff = Math.abs(b.amount - bestLedger.amount);
      const dateDiffDays = b.date && bestLedger.date ? Math.abs(b.date.getTime() - bestLedger.date.getTime()) / DAY_MS : 0;
      
      const status = amountDiff <= 2 ? "matched" : "partial";
      const reasons = [
        amountDiff <= 2 ? "Amount matches (diff <= ₹2)" : `Amount diff ₹${amountDiff.toFixed(2)}`,
        `Date within ${Math.round(dateDiffDays)}d`
      ];

      results.push({
        source: "bank",
        row: b,
        counterpart: bestLedger,
        status,
        reasons,
      });
    }
  }

  // Pass 3: Add remaining unmatched bank entries
  for (const b of bank) {
    if (results.some((r) => r.row.id === b.id)) continue;
    results.push({
      source: "bank",
      row: b,
      status: "unmatched",
      reasons: ["No corresponding invoice entry found"],
    });
  }

  // Pass 4: Add remaining unmatched ledger entries
  for (const l of ledger) {
    if (ledgerTaken.has(l.id)) continue;
    results.push({
      source: "ledger",
      row: l,
      status: "unmatched",
      reasons: ["No corresponding bank entry found"],
    });
  }

  console.log(`\n--- Reconciliation Finished: Matched: ${results.filter(r => r.status === 'matched').length}, Partial: ${results.filter(r => r.status === 'partial').length}, Unmatched: ${results.filter(r => r.status === 'unmatched').length} ---`);

  return results;
}

// Legacy export alias for backwards compatibility
export function reconcile(bank: NormalizedRow[], ledger: NormalizedRow[]): ReconRow[] {
  return reconcileBank(bank, ledger);
}
