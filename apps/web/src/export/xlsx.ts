import ExcelJS from "exceljs";
import { ROI_TABLE_COLUMNS, type RoiTableRow } from "./tableRows";

export async function rowsToXlsx(rows: RoiTableRow[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("rois");
  sheet.columns = ROI_TABLE_COLUMNS.map((key) => ({
    header: key,
    key,
    width: Math.max(10, key.length + 2),
  }));
  for (const row of rows) {
    sheet.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
