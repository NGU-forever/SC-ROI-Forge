import { ROI_TABLE_COLUMNS, type RoiTableRow } from "./tableRows";

function escapeCsvField(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: RoiTableRow[]): string {
  const header = ROI_TABLE_COLUMNS.join(",");
  const body = rows
    .map((row) =>
      ROI_TABLE_COLUMNS.map((col) => escapeCsvField(row[col])).join(","),
    )
    .join("\n");
  return `\uFEFF${header}\n${body}${body ? "\n" : ""}`;
}
