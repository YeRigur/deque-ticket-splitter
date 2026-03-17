import {
  parseCSV,
  buildCSV,
  chunkRows,
  slugify,
} from "./modules/csvUtils.js";
import { applyFilters } from "./modules/filters.js";
import { parseXLSX } from "./modules/xlsxUtils.js";

const elements = {
  fileInput: document.getElementById("reportFile"),
  fileInfo: document.getElementById("fileInfo"),
  issuesPerTicket: document.getElementById("issuesPerTicket"),
  columnsContainer: document.getElementById("columnsContainer"),
  generateBtn: document.getElementById("generateBtn"),
  generateStatus: document.getElementById("generateStatus"),
  downloadsContainer: document.getElementById("downloadsContainer"),
  preview: document.getElementById("preview"),
  chunkModeInputs: Array.from(
    document.querySelectorAll('input[name="chunkMode"]'),
  ),
};

const state = {
  headers: [],
  rows: [],
  selectedColumns: new Set(),
  fileName: "",
  downloadUrls: [],
  chunkMode: "chunks",
};

function init() {
  bindEvents();
  const initialMode =
    elements.chunkModeInputs.find((input) => input.checked)?.value || "chunks";
  state.chunkMode = initialMode === "single" ? "single" : "chunks";
  applyChunkModeToUI();
  updateGenerateButton();
  renderPreview();
}

function bindEvents() {
  elements.fileInput.addEventListener("change", handleFileSelection);
  elements.issuesPerTicket.addEventListener("change", handleIssuesChange);
  elements.generateBtn.addEventListener("click", handleGenerateClick);
  elements.chunkModeInputs.forEach((input) => {
    input.addEventListener("change", handleChunkModeChange);
  });
}

function handleChunkModeChange(event) {
  if (!event.target.checked) {
    return;
  }
  const value = event.target.value === "single" ? "single" : "chunks";
  state.chunkMode = value;
  applyChunkModeToUI();
  renderPreview();
  updateGenerateStatus(
    value === "single"
      ? "All issues will be merged into a single ticket."
      : "Issues will be split using the selected chunk size.",
    "status-muted",
  );
}

function applyChunkModeToUI() {
  const isSingle = state.chunkMode === "single";
  elements.issuesPerTicket.disabled = isSingle;
  const field = elements.issuesPerTicket.closest(".field");
  if (field) {
    field.classList.toggle("field-disabled", isSingle);
  }
  elements.chunkModeInputs.forEach((input) => {
    const label = input.closest(".radio-option");
    if (!label) {
      return;
    }
    const isActive = input.checked && input.value === state.chunkMode;
    label.classList.toggle("radio-option--active", isActive);
  });
}

function handleIssuesChange(event) {
  let value = Number(event.target.value);
  if (!Number.isFinite(value) || value <= 0) {
    value = 10;
    event.target.value = value;
  }
  if (state.chunkMode === "chunks") {
    updateGenerateStatus(
      `Chunk size set to ${event.target.value} issues per ticket.`,
      "status-muted",
    );
  }
  renderPreview();
}

async function handleFileSelection(event) {
  const file = event.target.files?.[0];
  resetDownloads();
  if (!file) {
    elements.fileInfo.textContent = "No file selected.";
    elements.fileInfo.title = "No file selected.";
    elements.fileInfo.classList.remove("status-success", "status-warning");
    elements.fileInfo.classList.add("status-muted");
    state.headers = [];
    state.rows = [];
    state.selectedColumns.clear();
    renderColumns();
    renderPreview();
    updateGenerateButton();
    return;
  }

  elements.fileInfo.textContent = `Selected: ${file.name}`;
  elements.fileInfo.title = file.name;
  elements.fileInfo.classList.remove("status-muted", "status-warning");
  elements.fileInfo.classList.add("status-success");

  try {
    const { headers, rows } = await parseFile(file);
    if (!headers.length) {
      throw new Error("The file has no header row.");
    }
    state.headers = headers;
    state.rows = rows;
    state.fileName = file.name.replace(/\.[^.]+$/, "") || "Deque report";
    selectAllColumns();
    renderColumns();
    renderPreview();
    updateGenerateButton();
    updateGenerateStatus(
      `Parsed ${rows.length} issues with ${headers.length} columns.`,
      "status-success",
    );
  } catch (error) {
    console.error(error);
    updateGenerateStatus(error.message, "status-warning");
    elements.fileInfo.textContent = "Failed to parse file.";
    elements.fileInfo.title = error.message;
    elements.fileInfo.classList.remove("status-success");
    elements.fileInfo.classList.add("status-warning");
    state.headers = [];
    state.rows = [];
    state.selectedColumns.clear();
    state.fileName = "";
    updateGenerateButton();
    renderColumns();
    renderPreview();
  }
}

function selectAllColumns() {
  state.selectedColumns = new Set(state.headers);
}

function renderColumns() {
  elements.columnsContainer.innerHTML = "";
  if (!state.headers.length) {
    elements.columnsContainer.innerHTML =
      '<div class="status status-muted">Upload a file to see columns.</div>';
    return;
  }

  if (!state.selectedColumns.size) {
    selectAllColumns();
  }

  state.headers.forEach((header) => {
    const id = `column-${slugify(header)}`;
    const wrapper = document.createElement("label");
    wrapper.className = "column-checkbox";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.checked = state.selectedColumns.has(header);
    input.addEventListener("change", () => {
      if (input.checked) {
        state.selectedColumns.add(header);
      } else {
        state.selectedColumns.delete(header);
      }
      updateGenerateButton();
      renderPreview();
    });

    const span = document.createElement("span");
    span.textContent = header;

    wrapper.appendChild(input);
    wrapper.appendChild(span);
    elements.columnsContainer.appendChild(wrapper);
  });
}

function handleGenerateClick() {
  const preparation = prepareRowsForOutput({ emitStatus: true });
  if (!preparation) {
    return;
  }

  const { trimmedRows, selectedColumns, issuesPerTicket } = preparation;
  const chunks = createTicketChunks(trimmedRows, issuesPerTicket);

  if (!chunks.length) {
    updateGenerateStatus("No tickets available to export.", "status-warning");
    return;
  }

  resetDownloads();

  const ticketRows = chunks.map((chunk, index) => ({
    Title: buildTicketTitle(index, chunks.length, chunk.length),
    Description: buildTicketDescriptionPreview(chunk, selectedColumns),
  }));

  const csvContent = buildCSV(
    ["Title", "Description"],
    ticketRows.map((row) => ({
      Title: row.Title,
      Description: row.Description,
    })),
  );

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  state.downloadUrls.push(url);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(getBaseTitle()) || "tickets"}__tickets.csv`;
  link.textContent = `Download CSV (${ticketRows.length} ticket${
    ticketRows.length === 1 ? "" : "s"
  })`;
  link.className = "download-link";

  const meta = document.createElement("span");
  const totalIssues = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  meta.textContent = `${totalIssues} issue${totalIssues === 1 ? "" : "s"} total`;
  link.appendChild(meta);

  elements.downloadsContainer.appendChild(link);

  const statusMessage =
    ticketRows.length === 1
      ? `Created one ticket row covering ${totalIssues} issue${
          totalIssues === 1 ? "" : "s"
        }.`
      : `Created ${ticketRows.length} ticket rows covering ${totalIssues} issues.`;

  updateGenerateStatus(statusMessage, "status-success");
}

function renderPreview() {
  elements.preview.innerHTML = "";

  if (!state.rows.length) {
    elements.preview.innerHTML =
      '<div class="status status-muted">Upload a file to see the preview.</div>';
    return;
  }

  if (!state.selectedColumns.size) {
    elements.preview.innerHTML =
      '<div class="status status-warning">Select at least one column to preview.</div>';
    return;
  }

  const preparation = prepareRowsForOutput({ emitStatus: false });
  if (!preparation) {
    elements.preview.innerHTML =
      '<div class="status status-warning">Unable to render preview for the current selection.</div>';
    return;
  }

  const { trimmedRows, selectedColumns, issuesPerTicket } = preparation;
  if (!trimmedRows.length) {
    elements.preview.innerHTML =
      '<div class="status status-warning">No rows available to preview.</div>';
    return;
  }

  const chunks = createTicketChunks(trimmedRows, issuesPerTicket);
  const firstChunk = chunks[0] || [];

  if (!firstChunk.length) {
    elements.preview.innerHTML =
      '<div class="status status-warning">No rows available to preview.</div>';
    return;
  }

  const titleElement = document.createElement("div");
  titleElement.className = "preview-title";
  titleElement.textContent = buildTicketTitle(
    0,
    chunks.length,
    firstChunk.length,
  );

  const info = document.createElement("p");
  info.className = "status status-muted preview-meta";
  info.textContent =
    state.chunkMode === "single"
      ? `All ${firstChunk.length} issue${
          firstChunk.length === 1 ? "" : "s"
        } will go into a single ticket.`
      : `Showing ticket 1 of ${chunks.length} (${firstChunk.length} issue${
          firstChunk.length === 1 ? "" : "s"
        } per ticket).`;

  const textarea = document.createElement("textarea");
  textarea.className = "preview-text";
  textarea.readOnly = true;
  textarea.value = buildTicketDescriptionPreview(
    firstChunk,
    selectedColumns,
  );
  textarea.rows = Math.min(
    24,
    Math.max(6, textarea.value.split("\n").length + 2),
  );

  elements.preview.appendChild(titleElement);
  elements.preview.appendChild(info);
  elements.preview.appendChild(textarea);
}

function updateGenerateButton() {
  const ready =
    state.rows.length > 0 && Array.from(state.selectedColumns).length > 0;
  elements.generateBtn.disabled = !ready;
}

function updateGenerateStatus(message, statusClass = "status-muted") {
  elements.generateStatus.textContent = message;
  elements.generateStatus.className = `status ${statusClass}`;
}

function resetDownloads() {
  state.downloadUrls.forEach((url) => URL.revokeObjectURL(url));
  state.downloadUrls = [];
  elements.downloadsContainer.innerHTML = "";
}

window.addEventListener("beforeunload", () => {
  resetDownloads();
});

function isXLSXFile(file) {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    type === "application/xlsx" ||
    type === "application/vnd.ms-excel" ||
    type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type.includes("spreadsheetml")
  );
}

function parseFile(file) {
  const name = file.name.toLowerCase();
  if (isXLSXFile(file)) {
    return readFileAsArrayBuffer(file).then((buffer) => parseXLSX(buffer));
  }

  if (name.endsWith(".csv") || (file.type || "").toLowerCase().includes("csv")) {
    return readFileAsText(file).then((text) => parseCSV(text));
  }

  throw new Error("Unsupported file type. Please upload a CSV or XLSX file.");
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Unsupported binary format."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsArrayBuffer(file);
  });
}

function prepareRowsForOutput({ emitStatus = false } = {}) {
  if (!state.rows.length) {
    if (emitStatus) {
      updateGenerateStatus(
        "Upload a file before generating output.",
        "status-warning",
      );
    }
    return null;
  }

  const selectedColumns = Array.from(state.selectedColumns);
  if (!selectedColumns.length) {
    if (emitStatus) {
      updateGenerateStatus("Select at least one column.", "status-warning");
    }
    return null;
  }

  const issuesPerTicket = Math.max(
    1,
    Math.floor(Number(elements.issuesPerTicket.value)) || 1,
  );

  const filteredRows = applyFilters(state.rows, {
    chunkMode: state.chunkMode,
    overrides: {
      issuesPerTicket,
      selectedColumns,
    },
  });

  if (!filteredRows.length) {
    if (emitStatus) {
      updateGenerateStatus(
        "No rows remain after applying filters.",
        "status-warning",
      );
    }
    return null;
  }

  const trimmedRows = filteredRows.map((row) => {
    const result = {};
    selectedColumns.forEach((column) => {
      result[column] = row[column] ?? "";
    });
    return result;
  });

  return { trimmedRows, selectedColumns, issuesPerTicket };
}

function createTicketChunks(rows, issuesPerTicket) {
  if (!rows.length) {
    return [];
  }
  if (state.chunkMode === "single") {
    return [rows];
  }
  return chunkRows(rows, issuesPerTicket);
}

function buildTicketTitle(index, totalChunks, chunkLength) {
  const baseTitle = getBaseTitle();
  const issueLabel = `${chunkLength} issue${
    chunkLength === 1 ? "" : "s"
  }`;

  if (state.chunkMode === "single") {
    return `${baseTitle} • ${issueLabel}`;
  }

  return `${baseTitle} • Ticket ${index + 1} of ${totalChunks} (${issueLabel})`;
}

function getBaseTitle() {
  const cleanName = (state.fileName || "").trim();
  return cleanName || "Deque report";
}

function buildTicketDescriptionPreview(rows, columns) {
  if (!rows.length || !columns.length) {
    return "No issues in this ticket.";
  }

  const lines = [];
  rows.forEach((row, index) => {
    const titleColumn = columns[0];
    const titleValue = (row[titleColumn] || "").toString().trim();
    const issueTitle = titleValue || `Issue ${index + 1}`;
    lines.push(`${index + 1}. ${issueTitle}`);

    columns.slice(1).forEach((column) => {
      const rawValue = row[column];
      if (rawValue == null || rawValue === "") {
        return;
      }
      const displayValue = rawValue.toString().trim();
      if (!displayValue) {
        return;
      }

      const valueLines = displayValue.split(/\r?\n/);
      valueLines.forEach((valueLine, lineIndex) => {
        const prefix = lineIndex === 0 ? `   - ${column}: ` : "     ";
        lines.push(`${prefix}${valueLine}`);
      });
    });

    if (index < rows.length - 1) {
      lines.push("");
    }
  });

  return lines.join("\n");
}

init();
