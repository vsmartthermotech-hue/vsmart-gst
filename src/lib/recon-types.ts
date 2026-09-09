export type ReconType = "bank" | "gst";

export type RawRow = Record<string, string | number | null>;

export type ColumnMap = {
  // Bank fields
  date?: string;
  amount?: string;
  reference?: string;

  // GST fields
  gstin?: string;
  invoiceNumber?: string;
  taxableAmount?: string;
  igst?: string;
  cgst?: string;
  sgst?: string;
};

export type NormalizedRow = {
  id: string;
  date: Date | null;
  dateRaw: string;
  amount: number;
  reference: string;
  raw: RawRow;

  // GST-specific normalized fields
  gstin?: string;
  invoiceNumber?: string;
  taxableAmount?: number;
  igst?: number;
  cgst?: number;
  sgst?: number;
  taxAmount?: number;
};

export type MatchStatus = "matched" | "partial" | "unmatched";

export type ReconRow = {
  source: "bank" | "ledger";
  row: NormalizedRow;
  status: MatchStatus;
  counterpart?: NormalizedRow;
  matchScore?: number; // 0-3 (amount, date, ref)
  reasons: string[];
  gstMismatches?: {
    igst: boolean;
    cgst: boolean;
    sgst: boolean;
  };
};
