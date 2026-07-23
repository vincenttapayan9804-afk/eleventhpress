/**
 * 1-click CSV/Excel export for any table extracted by src/lib/data-tables.ts
 * (Article/MagazinePiece/MediaPost body tables). Client-only — the table
 * data is already in the browser via the *-data-tables API response, so
 * this needs no server round-trip. Uses the free, open-source `xlsx`
 * (SheetJS Community Edition) library entirely locally: no external
 * service, no per-export cost.
 */
import type { ExtractedTable } from "@/lib/data-tables";

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function toAoa(table: Pick<ExtractedTable, "headers" | "rows">): string[][] {
  return [table.headers, ...table.rows];
}

export async function buildCsvString(table: Pick<ExtractedTable, "headers" | "rows">): Promise<string> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(toAoa(table));
  return XLSX.utils.sheet_to_csv(sheet);
}

export async function buildExcelBuffer(table: Pick<ExtractedTable, "headers" | "rows">): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(toAoa(table));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Table");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

export async function exportTableToCsv(table: Pick<ExtractedTable, "headers" | "rows">, filename: string): Promise<void> {
  const csv = await buildCsvString(table);
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export async function exportTableToExcel(table: Pick<ExtractedTable, "headers" | "rows">, filename: string): Promise<void> {
  const buffer = await buildExcelBuffer(table);
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
  );
}
