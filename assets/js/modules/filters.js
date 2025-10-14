/**
 * Placeholder for future filter logic.
 * Extend this function to filter or augment rows before they are chunked.
 *
 * @param {Array<Object>} rows Parsed CSV rows
 * @param {Object} context Includes the current chunk mode plus UI overrides
 * @returns {Array<Object>} Rows to use when building ticket CSVs
 */
export function applyFilters(rows, context) {
  // Example:
  // if (context.chunkMode === "single") {
  //   return rows.filter((row) => row["Impact"]?.toLowerCase() === "critical");
  // }

  return rows;
}
