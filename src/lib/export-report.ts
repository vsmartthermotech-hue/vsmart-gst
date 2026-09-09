import * as XLSX from "xlsx";
import type { ReconRow, ReconType } from "./recon-types";

export function exportReport(rows: ReconRow[], reconType: ReconType = "bank") {
  const wb = XLSX.utils.book_new();

  const buckets: Record<string, ReconRow[]> = {
    Matched: rows.filter((r) => r.status === "matched"),
    "Partial Match": rows.filter((r) => r.status === "partial"),
    Unmatched: rows.filter((r) => r.status === "unmatched"),
  };

  for (const [name, list] of Object.entries(buckets)) {
    let data: any[] = [];
    let wscols: any[] = [];

    if (reconType === "gst") {
      data = list.map((r) => ({
        "Supplier GSTIN": r.row.gstin || "—",
        "Invoice Number": r.row.reference || "—",
        "Invoice Date": r.row.dateRaw || "—",
        "Taxable Amount": r.row.taxableAmount !== undefined ? r.row.taxableAmount : "—",
        IGST: r.row.igst !== undefined ? r.row.igst : "—",
        CGST: r.row.cgst !== undefined ? r.row.cgst : "—",
        SGST: r.row.sgst !== undefined ? r.row.sgst : "—",
        "Total Tax": r.row.taxAmount !== undefined ? r.row.taxAmount : "—",
        "Total Invoice Amount": r.row.amount,
        "Counterpart GSTIN": r.counterpart?.gstin || "—",
        "Counterpart Invoice Number": r.counterpart?.reference || "—",
        "Counterpart Date": r.counterpart?.dateRaw || "—",
        "Counterpart Taxable Amount": r.counterpart?.taxableAmount !== undefined ? r.counterpart.taxableAmount : "—",
        "Counterpart IGST": r.counterpart?.igst !== undefined ? r.counterpart.igst : "—",
        "Counterpart CGST": r.counterpart?.cgst !== undefined ? r.counterpart.cgst : "—",
        "Counterpart SGST": r.counterpart?.sgst !== undefined ? r.counterpart.sgst : "—",
        "Counterpart Total Tax": r.counterpart?.taxAmount !== undefined ? r.counterpart.taxAmount : "—",
        "Counterpart Total Amount": r.counterpart?.amount !== undefined ? r.counterpart.amount : "—",
        Status: name,
        "Match Details / Reasons": r.reasons.join("; "),
      }));

      wscols = [
        { wch: 18 }, // Supplier GSTIN
        { wch: 20 }, // Invoice Number
        { wch: 15 }, // Invoice Date
        { wch: 18 }, // Taxable Amount
        { wch: 12 }, // IGST
        { wch: 12 }, // CGST
        { wch: 12 }, // SGST
        { wch: 15 }, // Total Tax
        { wch: 20 }, // Total Invoice Amount
        { wch: 18 }, // Counterpart GSTIN
        { wch: 20 }, // Counterpart Invoice Number
        { wch: 18 }, // Counterpart Date
        { wch: 22 }, // Counterpart Taxable Amount
        { wch: 15 }, // Counterpart IGST
        { wch: 15 }, // Counterpart CGST
        { wch: 15 }, // Counterpart SGST
        { wch: 18 }, // Counterpart Total Tax
        { wch: 22 }, // Counterpart Total Amount
        { wch: 15 }, // Status
        { wch: 45 }, // Match Details / Reasons
      ];
    } else {
      data = list.map((r) => ({
        Date: r.row.dateRaw || "—",
        "Credit Amount (Bank)": r.row.amount,
        "UTR / Reference": r.row.reference || "—",
        "Counterpart Invoice No.": r.counterpart?.reference || "—",
        "Counterpart Invoice Date": r.counterpart?.dateRaw || "—",
        "Counterpart Total Amount": r.counterpart?.amount !== undefined ? r.counterpart.amount : "—",
        Status: name,
        "Match Details / Reasons": r.reasons.join("; "),
      }));

      wscols = [
        { wch: 15 }, // Date
        { wch: 22 }, // Credit Amount (Bank)
        { wch: 25 }, // UTR / Reference
        { wch: 25 }, // Counterpart Invoice No.
        { wch: 22 }, // Counterpart Invoice Date
        { wch: 22 }, // Counterpart Total Amount
        { wch: 15 }, // Status
        { wch: 40 }, // Match Details / Reasons
      ];
    }

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const fileNamePrefix = reconType === "gst" ? "GST-Reconciliation-Report" : "Bank-Reconciliation-Report";
  XLSX.writeFile(wb, `${fileNamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
