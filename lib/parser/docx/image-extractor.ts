import type { DocumentAsset } from '../../types/document'
import type { AssetId } from '../../types/common'
import { slugify, uniqueSlug } from '../../utils/slug'

/**
 * Image extraction.
 *
 * WHY IMAGES ARE COLLECTED DURING CONVERSION
 * ------------------------------------------
 * Mammoth invokes a handler for every image it meets while walking the
 * document. Taking them there rather than by scanning `word/media/` afterwards
 * matters for two reasons:
 *
 *   1. **Alt text arrives with the image.** It lives on the drawing element in
 *      `document.xml`, not beside the bytes in the media folder. Scanning the
 *      folder would give us the pixels and lose the description — the single
 *      most important accessibility field a book has.
 *   2. **Unused media is skipped.** Word retains images the author deleted.
 *      Packaging those would inflate every export with content that appears
 *      nowhere in the book.
 *
 * The handler returns a `chiify-asset:` URL rather than a data URI. Mammoth's
 * default inlines every image as base64 into the HTML string, which for an
 * illustrated book means holding the entire manuscript's images, base64-encoded
 * (a third larger than the originals), in a single string — before any of it is
 * needed. The placeholder keeps the HTML small and the bytes in one place.
 */

/** Marks a `src` as a reference into the extracted asset table. */
export const ASSET_URL_PREFIX = 'chiify-asset:'

/** Image formats EPUB 3 reading systems are required to support. */
const CORE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'])

const EXTENSION_BY_MEDIA_TYPE: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
  'image/tiff': '.tif',
  'image/bmp': '.bmp',
  'image/x-emf': '.emf',
  'image/x-wmf': '.wmf',
}

export interface ExtractedImage {
  readonly asset: DocumentAsset
  /** True when the format is outside the EPUB core set and needs conversion. */
  readonly needsConversion: boolean
}

export interface ImageExtractor {
  /**
   * Called by Mammoth for each image; returns the placeholder attributes.
   *
   * Accepts a `Uint8Array` as well as an `ArrayBuffer` because Mammoth's Node
   * build hands back a `Buffer` while its browser build returns an
   * `ArrayBuffer`. Normalising here keeps that difference out of every caller.
   */
  add(
    bytes: ArrayBuffer | Uint8Array,
    mediaType: string,
    altText: string | undefined,
  ): { src: string; alt: string }
  /** Every asset collected so far, in the order encountered. */
  assets(): readonly DocumentAsset[]
  /** Assets whose format a reading system may not display. */
  unsupported(): readonly ExtractedImage[]
}

export function createImageExtractor(): ImageExtractor {
  const collected: ExtractedImage[] = []
  const takenNames = new Set<string>()
  let counter = 0

  return {
    add(input, mediaType, altText) {
      counter += 1

      const bytes = toArrayBuffer(input)

      const normalisedType = mediaType.toLowerCase().trim() || 'application/octet-stream'
      const extension = EXTENSION_BY_MEDIA_TYPE[normalisedType] ?? '.bin'

      // Names are derived from the alt text where there is one, so an export's
      // media folder is browsable rather than a wall of `image-0042.png`.
      const base = uniqueSlug(slugify(altText ?? '') || `image-${counter}`, takenNames)
      takenNames.add(base)

      const id = `ast_${String(counter).padStart(4, '0')}` as AssetId
      const dimensions = readImageDimensions(bytes, normalisedType)

      const asset: DocumentAsset = {
        id,
        fileName: `${base}${extension}`,
        mediaType: normalisedType,
        byteSize: bytes.byteLength,
        bytes,
        ...(dimensions.width !== undefined ? { width: dimensions.width } : {}),
        ...(dimensions.height !== undefined ? { height: dimensions.height } : {}),
        ...(dimensions.dpi !== undefined ? { dpi: dimensions.dpi } : {}),
      }

      collected.push({ asset, needsConversion: !CORE_MEDIA_TYPES.has(normalisedType) })

      return { src: `${ASSET_URL_PREFIX}${id}`, alt: altText ?? '' }
    },

    assets() {
      return collected.map((image) => image.asset)
    },

    unsupported() {
      return collected.filter((image) => image.needsConversion)
    },
  }
}

/**
 * Normalise whatever Mammoth handed back into a standalone `ArrayBuffer`.
 *
 * A Node `Buffer` is a view onto a *shared, pooled* allocation, so its
 * `.buffer` is usually far larger than the image and contains unrelated data.
 * Slicing at the view's own offsets is what makes the result a correct,
 * independently-owned copy — passing `.buffer` directly would store megabytes
 * of neighbouring allocations per image and corrupt the dimension probe.
 */
function toArrayBuffer(input: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (input instanceof Uint8Array) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer
  }

  return input
}

interface ImageDimensions {
  width?: number
  height?: number
  dpi?: number
}

/**
 * Read pixel dimensions from an image header.
 *
 * WHY PARSE HEADERS BY HAND
 * -------------------------
 * The alternative is decoding the image, which in the browser means an
 * `Image`/`createImageBitmap` round trip per picture — asynchronous, and
 * unavailable in Node or a worker without a canvas shim. Every format below
 * puts its dimensions in the first few dozen bytes, so reading them directly is
 * synchronous, environment-independent and costs nothing.
 *
 * Dimensions are advisory: they drive print-quality warnings and let an export
 * engine set `width`/`height` to prevent layout shift. An unreadable header
 * returns nothing rather than failing.
 */
export function readImageDimensions(bytes: ArrayBuffer, mediaType: string): ImageDimensions {
  try {
    const view = new DataView(bytes)

    if (mediaType === 'image/png') return readPng(view)
    if (mediaType === 'image/jpeg') return readJpeg(view)
    if (mediaType === 'image/gif') return readGif(view)
  } catch {
    // A truncated or unusual header is not worth a failed conversion.
  }

  return {}
}

/** PNG: an IHDR chunk at a fixed offset, plus an optional pHYs chunk. */
function readPng(view: DataView): ImageDimensions {
  if (view.byteLength < 24) return {}

  const dimensions: ImageDimensions = {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  }

  // pHYs stores pixels per metre; convert to DPI if present in the first
  // chunks, where it always is when written at all.
  let offset = 8
  while (offset + 8 < Math.min(view.byteLength, 1024)) {
    const length = view.getUint32(offset, false)
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7),
    )

    if (type === 'pHYs' && offset + 17 <= view.byteLength) {
      const perMetre = view.getUint32(offset + 8, false)
      const unit = view.getUint8(offset + 16)
      if (unit === 1 && perMetre > 0) {
        return { ...dimensions, dpi: Math.round(perMetre * 0.0254) }
      }
      break
    }

    if (type === 'IDAT') break
    offset += 12 + length
  }

  return dimensions
}

/** JPEG: walk the segment markers to the frame header. */
function readJpeg(view: DataView): ImageDimensions {
  let offset = 2
  let dpi: number | undefined

  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1
      continue
    }

    const marker = view.getUint8(offset + 1)
    const length = view.getUint16(offset + 2, false)

    // APP0/JFIF carries the density.
    if (marker === 0xe0 && offset + 13 < view.byteLength) {
      const units = view.getUint8(offset + 11)
      const density = view.getUint16(offset + 12, false)
      if (units === 1 && density > 0) dpi = density
      else if (units === 2 && density > 0) dpi = Math.round(density * 2.54)
    }

    // SOF0–SOF15, excluding the non-frame markers DHT, JPG and DAC.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

    if (isFrameHeader) {
      return {
        height: view.getUint16(offset + 5, false),
        width: view.getUint16(offset + 7, false),
        ...(dpi === undefined ? {} : { dpi }),
      }
    }

    if (length <= 0) break
    offset += 2 + length
  }

  return dpi === undefined ? {} : { dpi }
}

/** GIF: a fixed-position logical screen descriptor, little-endian. */
function readGif(view: DataView): ImageDimensions {
  if (view.byteLength < 10) return {}

  return {
    width: view.getUint16(6, true),
    height: view.getUint16(8, true),
  }
}
