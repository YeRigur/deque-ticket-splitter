/**
 * Parse a CSV string and return headers and row objects.
 * Supports RFC4180-style quoting and CRLF newlines.
 */
export function parseCSV(text) {
  const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let currentField = "";
  let currentRow = [];
  let inQuotes = false;

  for (let i = 0; i < normalised.length; i += 1) {
    const char = normalised[i];

    if (inQuotes) {
      if (char === '"') {
        const nextChar = normalised[i + 1];
        if (nextChar === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
    } else if (char === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  currentRow.push(currentField);
  rows.push(currentRow);

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow || [];
  const data = dataRows
    .filter((row) => row.some((value) => value.trim() !== ""))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    });

  return { headers, rows: data };
}

export function buildCSV(headers, rows) {
  const escapeCell = (value) => {
    if (value == null) {
      return "";
    }
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const bodyLines = rows.map((row) =>
    headers.map((header) => escapeCell(row[header])).join(","),
  );
  return [headerLine, ...bodyLines].join("\n");
}

export function chunkRows(rows, chunkSize) {
  const size = Math.max(1, Number(chunkSize) || 1);
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64) || "chunk";
}
