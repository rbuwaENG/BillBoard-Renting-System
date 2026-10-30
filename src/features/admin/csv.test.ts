import { describe, expect, it } from 'vitest'
import { csvFilename, toCsv } from './csv'

interface Row {
  name: string
  amount: number
  note?: string | null
}

const columns = [
  { header: 'Name', value: (r: Row) => r.name },
  { header: 'Amount', value: (r: Row) => r.amount },
  { header: 'Note', value: (r: Row) => r.note },
]

describe('toCsv', () => {
  it('writes a header row and one line per row', () => {
    const csv = toCsv<Row>([{ name: 'Alice', amount: 250 }], columns)
    expect(csv).toBe('Name,Amount,Note\r\nAlice,250,')
  })

  it('quotes cells containing commas, quotes or newlines', () => {
    const csv = toCsv<Row>(
      [{ name: 'Smith, John', amount: 1, note: 'said "hi"\nthen left' }],
      columns,
    )
    expect(csv.split('\r\n')[1]).toBe(
      '"Smith, John",1,"said ""hi""\nthen left"',
    )
  })

  it('neutralises spreadsheet formulas in text cells but not negative numbers', () => {
    const csv = toCsv<Row>(
      [{ name: '=HYPERLINK("x")', amount: -5, note: '@cmd' }],
      columns,
    )
    expect(csv.split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")",-5,'@cmd`)
  })

  it('emits only the header for an empty table', () => {
    expect(toCsv<Row>([], columns)).toBe('Name,Amount,Note')
  })
})

describe('csvFilename', () => {
  it('suffixes the ISO date', () => {
    expect(csvFilename('payments', new Date('2026-10-30T12:00:00Z'))).toBe(
      'payments-2026-10-30.csv',
    )
  })
})
