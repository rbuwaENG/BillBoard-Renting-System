// Dependency-free CSV generation for the admin "Export CSV" buttons.

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

// Cells starting with these characters are interpreted as formulas by
// spreadsheet apps (CSV injection) — user-supplied text gets a leading `'`.
const FORMULA_PREFIX = /^[=+\-@\t\r]/

function escapeCell(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): string {
  const lines = [columns.map((c) => escapeCell(c.header)).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(','))
  }
  return lines.join('\r\n')
}

// Triggers a browser download of `csv` as `filename`. The BOM makes Excel
// open UTF-8 (e.g. "රු" / "₹" currency labels) correctly.
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function csvFilename(name: string, now: Date = new Date()): string {
  return `${name}-${now.toISOString().slice(0, 10)}.csv`
}
