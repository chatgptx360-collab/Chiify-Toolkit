import type { GeneratedFile, PackagedBinary } from '../epub/types'
import type { EpubNavItem, EpubPackage } from '../types/epub'

import { READER_THEMES, type ReaderPreferences } from './devices'

/**
 * The preview renderer.
 *
 * WHAT MAKES THIS A PREVIEW RATHER THAN AN APPROXIMATION
 * ------------------------------------------------------
 * It renders the exact XHTML and the exact CSS that are inside the downloaded
 * file. Nothing is re-generated from the document model, and no separate
 * "preview markup" exists to drift away from the real thing. If a chapter looks
 * wrong here, it is wrong in the book — which is the only property that makes a
 * preview worth building.
 *
 * WHY IMAGES BECOME DATA URIS
 * ---------------------------
 * The preview runs inside a sandboxed iframe, which is what stops a book's
 * markup from touching the application around it. A sandboxed frame has an
 * opaque origin, and a `blob:` URL created by the parent belongs to the
 * parent's origin — so the image silently fails to load. Data URIs have no
 * origin to disagree about. They cost a third in size over the wire, which for
 * an in-memory preview is not a cost at all, and they mean the renderer works
 * unchanged in Node, where `URL.createObjectURL` does not exist.
 *
 * WHY LINKS ARE DEFUSED
 * ---------------------
 * A relative link inside `srcdoc` resolves against `about:srcdoc` and replaces
 * the chapter with a browser error page — the reader would appear to have
 * crashed. Fragment links stay live, because footnotes are exactly what an
 * author wants to test. Everything else is turned into a marked-up span of
 * text: visible, inert, and honest about being inert.
 *
 * WHY THE PREFERENCE LAYER COMES LAST
 * -----------------------------------
 * The point of the preview is to see the book under settings the author does
 * not control. So the simulated reader settings are appended after the book's
 * own stylesheet and win every conflict — which is precisely what a real
 * reading system does, and why a stylesheet that fixes a font size is reported
 * as a fault.
 */

export interface PreviewChapter {
  /** Manifest id, stable across renders. */
  readonly id: string
  readonly href: string
  readonly title: string
  /** Body markup, already rewritten for the preview. */
  readonly body: string
  /** False for the cover and the contents, which sit outside the reading flow. */
  readonly linear: boolean
}

export interface PreviewRenderer {
  readonly chapters: readonly PreviewChapter[]
  /** A complete HTML document for an iframe's srcdoc. */
  render(chapter: PreviewChapter, preferences: ReaderPreferences): string
  find(href: string): PreviewChapter | undefined
}

export interface PreviewRendererInput {
  readonly epub: EpubPackage
  readonly files: readonly GeneratedFile[]
  readonly binaries: readonly PackagedBinary[]
}

export function createPreviewRenderer(input: PreviewRendererInput): PreviewRenderer {
  const fileByHref = new Map(input.files.map((file) => [file.resource.href, file]))

  const imageByHref = new Map(
    input.binaries.map((binary) => [
      binary.resource.href,
      dataUri(binary.resource.mediaType, binary.bytes),
    ]),
  )

  const labelByHref = new Map<string, string>()
  collectLabels(input.epub.navigation, labelByHref)

  const stylesheet = input.files
    .filter((file) => file.resource.mediaType === 'text/css')
    .map((file) => file.content)
    .join('\n')

  const chapters: PreviewChapter[] = []

  for (const item of input.epub.spine) {
    const resource = input.epub.resources.find((candidate) => candidate.id === item.idref)
    if (!resource) continue

    const file = fileByHref.get(resource.href)
    if (!file) continue

    chapters.push({
      id: resource.id,
      href: resource.href,
      title: titleFor(resource.href, file.content, labelByHref),
      body: rewriteBody(extractBody(file.content), resource.href, imageByHref),
      linear: item.linear,
    })
  }

  return {
    chapters,
    find: (href) => chapters.find((chapter) => chapter.href === href),

    render(chapter, preferences) {
      const colours = READER_THEMES[preferences.theme]

      return [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8"/>',
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
        `<title>${escapeAttribute(chapter.title)}</title>`,
        `<style>${sanitiseCss(stylesheet)}</style>`,
        `<style>${preferenceCss(preferences, colours)}</style>`,
        '</head>',
        `<body>${chapter.body}</body>`,
        '</html>',
      ].join('')
    },
  }
}

/**
 * Simulated reader settings.
 *
 * `ch` for the measure rather than `rem`: a measure is a number of characters,
 * and expressing it in characters keeps it correct when the font scale moves,
 * which is the whole point of being able to move the font scale.
 */
function preferenceCss(
  preferences: ReaderPreferences,
  colours: { background: string; foreground: string },
): string {
  return [
    `html{font-size:${Math.round(preferences.fontScale * 100)}%;background:${colours.background}}`,
    `body{margin:0 auto;padding:1.5rem 1.25rem 4rem;max-width:${preferences.measure}ch;`,
    `background:${colours.background};color:${colours.foreground};`,
    `line-height:${preferences.lineHeight};`,
    `text-align:${preferences.justify ? 'justify' : 'start'};`,
    preferences.justify ? 'hyphens:auto;' : '',
    '}',
    'img{max-width:100%;height:auto}',
    'table{max-width:100%;border-collapse:collapse}',
    // Defused links stay legible but do not pretend to work.
    'a[data-preview-href]{text-decoration:underline dotted;cursor:not-allowed}',
    'a[href^="#"]{text-decoration:underline}',
  ].join('')
}

/** The contents of `<body>`, or the whole document if it has none. */
function extractBody(xhtml: string): string {
  const open = xhtml.search(/<body\b/i)
  if (open === -1) return xhtml

  const start = xhtml.indexOf('>', open)
  const end = xhtml.lastIndexOf('</body>')

  if (start === -1 || end === -1 || end < start) return xhtml

  return xhtml.slice(start + 1, end)
}

/**
 * Rewrite references so the fragment can stand alone.
 *
 * String rewriting rather than a parse: the markup being rewritten was
 * generated by this application from a known template, the two attributes that
 * need changing are unambiguous, and a full parse-and-serialise round trip
 * would risk changing markup the preview exists to show faithfully.
 */
function rewriteBody(body: string, href: string, images: ReadonlyMap<string, string>): string {
  const withImages = body.replace(/<img\b([^>]*)>/gi, (tag, attributes: string) => {
    const source = attributes.match(/\bsrc="([^"]*)"/i)?.[1]
    if (!source) return tag

    const resolved = images.get(resolve(href, source))
    if (!resolved) return tag

    return `<img${attributes.replace(/\bsrc="[^"]*"/i, `src="${resolved}"`)}>`
  })

  return withImages.replace(/<a\b([^>]*)>/gi, (tag, attributes: string) => {
    const target = attributes.match(/\bhref="([^"]*)"/i)?.[1]
    if (target === undefined || target.startsWith('#')) return tag

    return `<a${attributes.replace(/\bhref="[^"]*"/i, `data-preview-href="${escapeAttribute(target)}"`)}>`
  })
}

/** Resolve a reference relative to the document that wrote it. */
function resolve(fromHref: string, reference: string): string {
  const target = reference.split('#')[0] ?? ''
  const segments = fromHref.split('/').slice(0, -1)

  for (const segment of target.split('/')) {
    if (segment === '.' || segment.length === 0) continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }

  return segments.join('/')
}

/**
 * A readable chapter name.
 *
 * The navigation label is preferred over the document title because it is what
 * the reader will see in their own contents list — so a mismatch between the
 * two shows up here rather than on a device.
 */
function titleFor(href: string, content: string, labels: ReadonlyMap<string, string>): string {
  const label = labels.get(href)
  if (label) return label

  const title = content.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim()
  if (title) return title

  const heading = content.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]
  if (heading) {
    const text = heading.replace(/<[^>]+>/g, '').trim()
    if (text) return text
  }

  return href.split('/').pop() ?? href
}

function collectLabels(items: readonly EpubNavItem[], into: Map<string, string>): void {
  for (const item of items) {
    const href = item.href.split('#')[0] ?? item.href
    if (!into.has(href)) into.set(href, item.label)
    if (item.children) collectLabels(item.children, into)
  }
}

/** Stop a stylesheet from closing its own style element. */
function sanitiseCss(css: string): string {
  return css.replace(/<\/(style)/gi, '<\\/$1')
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function dataUri(mediaType: string, bytes: ArrayBuffer): string {
  return `data:${mediaType};base64,${toBase64(new Uint8Array(bytes))}`
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Base64 without a global.
 *
 * `btoa` is browser-only and `Buffer` is Node-only, so using either would make
 * this module work in one environment and throw in the other. Twenty lines
 * removes the branch entirely, and the preview is then testable without a DOM.
 */
export function toBase64(bytes: Uint8Array): string {
  let result = ''

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]

    result += BASE64_ALPHABET[a >> 2]
    result += BASE64_ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]
    result += b === undefined ? '=' : BASE64_ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]
    result += c === undefined ? '=' : BASE64_ALPHABET[c & 63]
  }

  return result
}
