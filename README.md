# Deque Report Splitter (static UI)

Static HTML/JS tool that lets you upload a Deque accessibility export, choose how to bundle the issues, and download a CSV with ticket-ready Title/Description fields.

## Quick start

1. Serve the folder over HTTP (e.g. `cd splitter-app && python3 -m http.server 5173`) and visit the printed URL. Opening the file directly with `file://` will be blocked by browser security rules for ES modules and fetch.
2. Pick whether you want separate tickets by chunk size or one ticket containing every issue, then set the chunk size if applicable.
3. Upload your Deque export file (`.csv` or `.xlsx`). Columns are auto-detected and can be toggled on/off.
4. Click **Generate CSV** to download a file that only contains `Title` and `Description` columns ready for ticket import.
5. Preview panel shows the first ticket (title + description) exactly as it will appear in the CSV.

## Making it your own

- Extra filter logic can be dropped into `assets/js/modules/filters.js`. The `applyFilters` function receives all parsed rows plus contextual metadata (chunk mode, chunk size, selected columns).
- Styling is handled by `assets/css/styles.css`.
- XLSX uploads rely on the bundled SheetJS build in `assets/js/vendor/xlsx.full.min.js`. Update that file if you want a newer release.

Once you're happy, commit the folder as-is to a GitHub repository and enable GitHub Pages (or any static hosting) so others can use it directly in the browser.
