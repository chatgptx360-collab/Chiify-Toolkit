import type { GeneratedFile, PackagedBinary } from '../epub/types'
import type { EpubPackage } from '../types/epub'
import type { BookMetadata, ProjectSettings } from '../types/project'

import type { InspectedDocument, InspectionSubject } from './types'
import { scanXml } from './xml-scan'

/**
 * Preparing the subject of an inspection.
 *
 * Every inspector needs the same three things: the described package, the
 * generated text, and the markup broken into elements. Scanning once here
 * rather than seven times inside the inspectors is the difference between a
 * validation run that is imperceptible and one an author waits for on a long
 * book.
 *
 * It is also what makes an inspector a pure function of its input, which is why
 * they are trivially testable and why the engine can run them in any order.
 */

export interface PrepareSubjectInput {
  readonly epub: EpubPackage
  readonly files: readonly GeneratedFile[]
  readonly binaries: readonly PackagedBinary[]
  readonly metadata: BookMetadata
  readonly settings: ProjectSettings
  /** Size of the packaged artifact; the compatibility checker enforces limits. */
  readonly byteSize: number
}

/** Media types worth running through the XML scanner. */
const XML_MEDIA_TYPES = new Set([
  'application/xhtml+xml',
  'application/oebps-package+xml',
  'application/x-dtbncx+xml',
  'image/svg+xml',
])

export function prepareSubject(input: PrepareSubjectInput): InspectionSubject {
  const documents: InspectedDocument[] = input.files.map((file) => {
    const isXml = XML_MEDIA_TYPES.has(file.resource.mediaType)

    if (!isXml) {
      return {
        href: file.resource.href,
        source: file.content,
        elements: [],
        ids: new Set<string>(),
        errors: [],
        mediaType: file.resource.mediaType,
      }
    }

    const scan = scanXml(file.content)

    return {
      href: file.resource.href,
      source: file.content,
      elements: scan.elements,
      ids: scan.ids,
      errors: scan.errors,
      mediaType: file.resource.mediaType,
    }
  })

  return {
    epub: input.epub,
    files: input.files,
    binaries: input.binaries,
    metadata: input.metadata,
    settings: input.settings,
    documents,
    manifestHrefs: new Set(input.epub.resources.map((resource) => resource.href)),
    byteSize: input.byteSize,
  }
}

/** Content documents only — the package document and NCX are not readable pages. */
export function contentDocuments(subject: InspectionSubject): readonly InspectedDocument[] {
  return subject.documents.filter((document) => document.mediaType === 'application/xhtml+xml')
}

export function documentByHref(
  subject: InspectionSubject,
  href: string,
): InspectedDocument | undefined {
  return subject.documents.find((document) => document.href === href)
}

/**
 * Resolve a relative href against the document that wrote it.
 *
 * Chapters live in `text/` and images in `images/`, so a chapter references an
 * image as `../images/plate.png`. Comparing that string to the manifest, which
 * stores `images/plate.png`, is the single most common way a validator reports
 * a broken reference that is not broken — or misses one that is.
 */
export function resolveHref(fromHref: string, reference: string): string {
  const target = reference.split('#')[0] ?? ''
  if (target.length === 0) return fromHref

  const segments = fromHref.split('/').slice(0, -1)

  for (const segment of target.split('/')) {
    if (segment === '.' || segment.length === 0) continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }

  return segments.join('/')
}

/** The fragment of a reference, if it has one. */
export function fragmentOf(reference: string): string | undefined {
  const hash = reference.indexOf('#')
  return hash === -1 ? undefined : reference.slice(hash + 1)
}

/** True for references that leave the container. */
export function isRemote(reference: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(reference) || /^(?:mailto|tel|data):/i.test(reference)
}
