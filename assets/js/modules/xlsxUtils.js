/**
 * Parse XLSX data and return headers and row objects.
 * Requires the global XLSX object provided by SheetJS.
 *
 * @param {ArrayBuffer} arrayBuffer Binary data from FileReader
 * @returns {{ headers: string[], rows: Array<Object> }}
 */
export function parseXLSX(arrayBuffer) {
  if (typeof XLSX === "undefined") {
    throw new Error(
      "XLSX parser not loaded. Ensure xlsx.full.min.js is included before app.js.",
    );
  }

  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The XLSX file has no sheets.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow;
  const data = dataRows.map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });

  return { headers, rows: data };
}
