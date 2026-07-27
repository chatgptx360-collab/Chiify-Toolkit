/**
 * EPUB 3 container constants.
 *
 * These are fixed by the OCF/EPUB specifications, not by preference. Centralising
 * them means Phase 4's generator, Phase 5's validator and the preview all agree
 * on paths and media types — mismatches here are the classic cause of an EPUB
 * that opens in one reader and fails in another.
 */

/** The OCF container is a zip; the mimetype entry must be first and unstored. */
export const EPUB_MEDIA_TYPE = 'application/epub+zip'

/** Fixed OCF paths. */
export const OCF_PATHS = {
  mimetype: 'mimetype',
  container: 'META-INF/container.xml',
  /** Everything the book owns lives under this root. */
  contentRoot: 'OEBPS',
  packageDocument: 'OEBPS/content.opf',
  navigationDocument: 'OEBPS/nav.xhtml',
  stylesheet: 'OEBPS/styles/book.css',
  textDirectory: 'OEBPS/text',
  imageDirectory: 'OEBPS/images',
  fontDirectory: 'OEBPS/fonts',
} as const

/** XML namespaces required by the package and navigation documents. */
export const XML_NAMESPACES = {
  opf: 'http://www.idpf.org/2007/opf',
  dc: 'http://purl.org/dc/elements/1.1/',
  xhtml: 'http://www.w3.org/1999/xhtml',
  epub: 'http://www.idpf.org/2007/ops',
  container: 'urn:oasis:names:tc:opendocument:xmlns:container',
} as const

/**
 * Image formats that EPUB 3 reading systems must support.
 *
 * Anything outside this list has to be converted before packaging; keeping the
 * list here means the parser can warn at import time rather than the user
 * discovering it after a full conversion.
 */
export const CORE_IMAGE_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml',
] as const

/** Media type lookup for the manifest, keyed by lowercase extension. */
export const MEDIA_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.xhtml': 'application/xhtml+xml',
  '.html': 'application/xhtml+xml',
  '.css': 'text/css',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ncx': 'application/x-dtbncx+xml',
}

/**
 * Resolve a manifest media type from a resource path.
 *
 * Falls back to `application/octet-stream`, which is what the spec expects for
 * unknown binary resources — silently dropping the resource would produce a
 * book with broken references.
 */
export function mediaTypeForPath(path: string): string {
  const dot = path.lastIndexOf('.')
  if (dot === -1) return 'application/octet-stream'

  return MEDIA_TYPE_BY_EXTENSION[path.slice(dot).toLowerCase()] ?? 'application/octet-stream'
}
