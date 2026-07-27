import JSZip from 'jszip'

import { appError, err, ok, type Result } from '../utils/result'
import { slugify } from '../utils/slug'
import type { EpubArtifact, EpubPackage } from '../types/epub'

import { EPUB_MEDIA_TYPE, OCF_PATHS } from './constants'
import { buildContainerXml, MIMETYPE_CONTENT } from './container'
import type { EpubPackager, GeneratedFile, PackagedBinary } from './types'

/**
 * Packaging — the described book becomes bytes.
 *
 * THE ONE RULE THAT BREAKS EVERYTHING IF IGNORED
 * ----------------------------------------------
 * The `mimetype` entry must be **first in the archive** and **stored
 * uncompressed**, with no extra field. That is not a style preference: the OCF
 * specification defines it so a reading system can identify an EPUB by reading
 * the first thirty bytes of the file, before doing any zip work at all.
 *
 * Get it wrong and the failure is confusing rather than obvious — the archive
 * is a perfectly valid zip, every other file is correct, and some readers open
 * it happily while Apple Books and EPUBCheck reject it outright. Hence the
 * explicit `compression: 'STORE'` and the deliberate ordering below, both of
 * which look like fussiness and are not.
 *
 * DEFLATE FOR EVERYTHING ELSE
 * ---------------------------
 * XHTML and CSS compress to roughly a fifth of their size. Images are already
 * compressed, so re-compressing them costs time and saves nothing — they are
 * stored instead, which measurably speeds up packaging an illustrated book.
 */

/** Formats that are already compressed; deflating them is wasted work. */
const PRECOMPRESSED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export interface PackagerOptions {
  /** 1–9. Six is the point past which zip size stops improving noticeably. */
  readonly compressionLevel?: number
  readonly onProgress?: (ratio: number) => void
  readonly signal?: AbortSignal
}

export function createEpubPackager(options: PackagerOptions = {}): EpubPackager {
  const level = options.compressionLevel ?? 6

  return {
    async package(
      epub: EpubPackage,
      files: readonly GeneratedFile[],
      binaries: readonly PackagedBinary[],
    ): Promise<Result<EpubArtifact>> {
      try {
        const zip = new JSZip()

        // 1. mimetype — first, uncompressed, no newline.
        zip.file(OCF_PATHS.mimetype, MIMETYPE_CONTENT, {
          compression: 'STORE',
          // A fixed date keeps the output byte-identical between runs of the
          // same book, which is what makes a rebuild diffable.
          date: FIXED_DATE,
        })

        // 2. The container, at its fixed path.
        zip.file(OCF_PATHS.container, buildContainerXml(), {
          compression: 'DEFLATE',
          compressionOptions: { level },
          date: FIXED_DATE,
        })

        // 3. Text resources.
        for (const file of files) {
          zip.file(`${OCF_PATHS.contentRoot}/${file.resource.href}`, file.content, {
            compression: 'DEFLATE',
            compressionOptions: { level },
            date: FIXED_DATE,
          })
        }

        options.onProgress?.(0.4)

        // 4. Binaries.
        for (const binary of binaries) {
          if (options.signal?.aborted) return err(cancelledError())

          zip.file(`${OCF_PATHS.contentRoot}/${binary.resource.href}`, binary.bytes, {
            compression: PRECOMPRESSED.has(binary.resource.mediaType) ? 'STORE' : 'DEFLATE',
            compressionOptions: { level },
            date: FIXED_DATE,
          })
        }

        options.onProgress?.(0.6)

        // `blob` in the browser, `nodebuffer` under test. Checking for `Blob`
        // rather than for `window` keeps this working in a Web Worker, which
        // has no `window` but does have `Blob`.
        const useBlob = typeof Blob !== 'undefined'

        const output = await zip.generateAsync(
          {
            type: useBlob ? 'blob' : 'nodebuffer',
            mimeType: EPUB_MEDIA_TYPE,
            // Set per file above; this is only the default for anything that
            // did not specify one.
            compression: 'DEFLATE',
            compressionOptions: { level },
          },
          (update) => {
            // JSZip reports 0–100 across the whole archive. Mapped into the
            // back 40% of the bar, since the files were already written.
            options.onProgress?.(0.6 + (update.percent / 100) * 0.4)
          },
        )

        if (options.signal?.aborted) return err(cancelledError())

        const blob =
          useBlob && output instanceof Blob
            ? output
            : new Blob([output as unknown as ArrayBuffer], { type: EPUB_MEDIA_TYPE })

        return ok({
          fileName: epubFileName(epub),
          mediaType: EPUB_MEDIA_TYPE,
          byteSize: blob.size,
          blob,
        })
      } catch (cause) {
        return err(
          appError('epub.packaging-failed', 'The EPUB file could not be assembled.', {
            hint: 'This usually means the browser ran out of memory. Close other tabs and try again, or reduce the size of the images in your manuscript.',
            cause,
          }),
        )
      }
    },
  }
}

/**
 * A fixed timestamp for every entry.
 *
 * Zip entries carry a modification date. Using "now" makes two builds of an
 * unchanged book produce different bytes, which defeats caching and makes it
 * impossible to tell whether a rebuild actually changed anything.
 */
const FIXED_DATE = new Date('2000-01-01T00:00:00Z')

/**
 * Name the downloaded file after the book.
 *
 * A folder of `book.epub`, `book (1).epub`, `book (2).epub` is what an author
 * gets from a tool that does not bother. The title, slugified, is both safe on
 * every filesystem and recognisable in a downloads list.
 */
function epubFileName(epub: EpubPackage): string {
  const title = epub.metadata.title
  const text = Array.isArray(title) ? title[0] : title

  return `${slugify(String(text ?? '')) || 'book'}.epub`
}

function cancelledError() {
  return appError('epub.cancelled', 'Building the EPUB was cancelled.', {
    severity: 'info',
  })
}
