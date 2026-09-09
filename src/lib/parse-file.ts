import * as XLSX from "xlsx";
import type { RawRow } from "./recon-types";

export type ParsedFile = {
  columns: string[];
  rows: RawRow[];
  fileName: string;
};

export async function parseFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  // cellDates: true tells SheetJS to parse dates as Date objects when possible
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  
  // Extract all data as an array of arrays to get headers and row values reliably
  const sheetData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  const rawHeaders = sheetData[0] || [];
  
  // Format column headers: trim and handle any missing headers
  const columns = rawHeaders.map((h, i) => {
    const trimmed = String(h ?? "").trim();
    return trimmed !== "" ? trimmed : `Column ${i + 1}`;
  });
  
  // Map rows array to row objects mapping each cell to its column header
  const rows = sheetData.slice(1).map((rowArr) => {
    const rowObj: RawRow = {};
    columns.forEach((colName, index) => {
      rowObj[colName] = rowArr[index] !== undefined && rowArr[index] !== null ? rowArr[index] : "";
    });
    return rowObj;
  });
  
  return { columns, rows, fileName: file.name };
}
