import { describe, expect, it } from 'vitest'
import {
  fileTypeError,
  getFilename,
  IMAGE_MIME_TYPES,
  IMAGE_TYPES_LABEL,
  MEDIA_MIME_TYPES,
  MEDIA_TYPES_LABEL,
  safeStorageName,
  uploadPath,
} from './fileKind'

describe('safeStorageName', () => {
  it.each([
    ['artwork.png', 'artwork.png'],
    ['My Summer Ad (final).PNG', 'My-Summer-Ad-final.png'],
    ['../../etc/passwd', 'passwd'],
    ['..\\..\\evil.pdf', 'evil.pdf'],
    ['a..b...c.jpg', 'a.b.c.jpg'],
    ['café menü.jpg', 'cafe-menu.jpg'],
    ['පින්තූරය.png', 'file.png'],
    ['广告.mp4', 'file.mp4'],
    ['.hidden', 'hidden'],
    ['noext', 'noext'],
    ['', 'file'],
    ['weird name.p n g', 'weird-name.png'],
  ])('%s → %s', (input, expected) => {
    expect(safeStorageName(input)).toBe(expected)
  })

  it('only ever produces safe ASCII without traversal segments', () => {
    for (const name of ['../x', 'a/../../b', ' spaced out .txt', '😀.gif']) {
      const safe = safeStorageName(name)
      expect(safe).toMatch(/^[A-Za-z0-9._-]+$/)
      expect(safe).not.toContain('..')
      expect(safe).not.toContain('/')
    }
  })
})

describe('uploadPath', () => {
  it('prefixes a uuid to the slug and round-trips through getFilename', () => {
    const path = uploadPath('booking-1', { name: 'My Ad.png' })
    expect(path).toMatch(/^booking-1\/[0-9a-f-]{36}-My-Ad\.png$/)
    expect(getFilename(path)).toBe('My-Ad.png')
  })

  it('omits the folder when there is no prefix', () => {
    expect(uploadPath(null, { name: 'logo.webp' })).toMatch(
      /^[0-9a-f-]{36}-logo\.webp$/,
    )
  })
})

describe('fileTypeError', () => {
  it('accepts allow-listed types and rejects SVG and others', () => {
    const png = { name: 'a.png', type: 'image/png' }
    const svg = { name: 'a.svg', type: 'image/svg+xml' }
    const pdf = { name: 'a.pdf', type: 'application/pdf' }
    expect(fileTypeError(png, IMAGE_MIME_TYPES, IMAGE_TYPES_LABEL)).toBeNull()
    expect(fileTypeError(svg, IMAGE_MIME_TYPES, IMAGE_TYPES_LABEL)).toMatch(
      /"a\.svg" can't be uploaded — use JPEG, PNG/,
    )
    expect(
      fileTypeError(pdf, IMAGE_MIME_TYPES, IMAGE_TYPES_LABEL),
    ).not.toBeNull()
    expect(fileTypeError(pdf, MEDIA_MIME_TYPES, MEDIA_TYPES_LABEL)).toBeNull()
    expect(
      fileTypeError(svg, MEDIA_MIME_TYPES, MEDIA_TYPES_LABEL),
    ).not.toBeNull()
  })
})
