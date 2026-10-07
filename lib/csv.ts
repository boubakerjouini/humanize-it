// ===========================================================
// lib/csv.ts — CSV export (pure).
//
// toCsv quotes per RFC 4180 and guards against formula injection: a cell that
// starts with = + - @ (or a tab / carriage return, which some spreadsheet apps
// strip before evaluating) is prefixed with a single quote, so an exported
// contact named "=HYPERLINK(...)" opens as text, not as a live formula. The
// file starts with a UTF-8 BOM so Excel reads accented names correctly.
// ===========================================================

export type CsvValue = string | number | boolean | Date | null | undefined | readonly string[];

export type CsvColumn<T> = { header: string; value: (row: T) => CsvValue };

export const CSV_BOM = "﻿";

const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

function stringify(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (Array.isArray(value)) return value.join("; ");
  return String(value);
}

/** One escaped cell: formula guard first, then quoting. */
export function csvCell(value: CsvValue): string {
  let text = stringify(value);
  // Numbers are safe as-is (a negative number is data, not a formula).
  if (typeof value !== "number" && FORMULA_PREFIX.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header row plus one line per row, CRLF separated, with a leading BOM. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}
