import JSZip from 'jszip'

import { err, ok, type Result } from '../../utils/result'
import { formatFileSize } from '../../utils/format'

import {
  corruptError,
  emptyFileError,
  encryptedError,
  legacyFormatError,
  missingDocumentXmlError,
  notADocxError,
  tooLargeError,
} from './errors'

/**
 * DOCX validation.
 *
 * WHY VALIDATION IS ITS OWN SERVICE
 * ---------------------------------
 * Validation answers "can this be parsed at all?" and it must answer *cheaply*
 * and *before* any expensive work. Checking magic bytes costs microseconds;
 * discovering the same problem halfway through a conversion costs the user a
 * progress bar that dies at 60% with an unhelpful message.
 *
 * The checks run cheapest-first, so a 400 MB `.pages` file is rejected on its
 * extension without ever being read into memory.
 *
 * WHY MAGIC BYTES RATHER THAN THE MEDIA TYPE
 * ------------------------------------------
 * Browsers report `.docx` inconsistently — often `application/octet-stream`
 * on Linux, and whatever the OS guessed when a file arrives by drag-and-drop.
 * The first four bytes of the file are the only trustworthy signal, and they
 * also let us tell a *renamed* `.doc` or an encrypted package apart from a
 * genuinely damaged file, which produces three different, useful messages
 * instead of one vague one.
 */

/** File signatures, checked against the first bytes of the upload. */
const SIGNATURES = {
  /** `PK` — a ZIP local file header. Every .docx starts with this. */
  zip: [0x50, 0x4b, 0x03, 0x04],
  /** An empty ZIP (`PK`). Structurally valid, but has no content. */
  emptyZip: [0x50, 0x4b, 0x05, 0x06],
  /**
   * OLE2 compound document. Used by Word 97–2003 (`.doc`) *and* by encrypted
   * Office files of any age, so it needs a second check to tell them apart.
   */
  ole2: [0xd0, 0xcf, 0x11, 0xe0],
} as const

/** 64 MB — comfortably above any realistic manuscript. */
export const MAX_DOCX_BYTES = 64 * 1024 * 1024

/** The one part every Word package must contain. */
const MAIN_DOCUMENT_PART = 'word/document.xml'

/** Marks an OLE2 file as an encrypted package rather than a legacy `.doc`. */
const ENCRYPTION_MARKER = 'EncryptedPackage'

export interface ValidationInput {
  readonly fileName: string
  readonly byteSize: number
  readonly bytes: ArrayBuffer
}

/** A validated file, with its opened archive handed on so it is read once. */
export interface ValidatedDocx {
  readonly fileName: string
  readonly zip: JSZip
}

export interface DocumentValidator {
  validate(input: ValidationInput): Promise<Result<ValidatedDocx>>
}

/**
 * Read the leading bytes and test them against a signature.
 *
 * Tolerates short files by returning `false` rather than reading past the end.
 */
function hasSignature(bytes: ArrayBuffer, signature: readonly number[]): boolean {
  if (bytes.byteLength < signature.length) return false
  const head = new Uint8Array(bytes, 0, signature.length)

  return signature.every((byte, index) => head[index] === byte)
}

/**
 * Scan the first kilobytes for an ASCII marker.
 *
 * Used only to distinguish an encrypted package from a legacy `.doc`. Both are
 * OLE2 containers; the encrypted one names an `EncryptedPackage` stream in its
 * directory, which sits near the start of the file.
 */
function containsAsciiMarker(bytes: ArrayBuffer, marker: string): boolean {
  const window = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 8192))
  const target = marker.split('').map((character) => character.charCodeAt(0))

  outer: for (let index = 0; index <= window.length - target.length; index += 1) {
    for (let offset = 0; offset < target.length; offset += 1) {
      // OLE2 directory entries are UTF-16LE, so the ASCII characters are
      // interleaved with null bytes. Accept both encodings.
      if (window[index + offset] !== target[offset]) continue outer
    }
    return true
  }

  // Retry as UTF-16LE.
  outer16: for (let index = 0; index <= window.length - target.length * 2; index += 1) {
    for (let offset = 0; offset < target.length; offset += 1) {
      if (window[index + offset * 2] !== target[offset]) continue outer16
      if (window[index + offset * 2 + 1] !== 0) continue outer16
    }
    return true
  }

  return false
}

export function createDocumentValidator(options: { maxBytes?: number } = {}): DocumentValidator {
  const maxBytes = options.maxBytes ?? MAX_DOCX_BYTES

  return {
    async validate(input) {
      const { fileName, byteSize, bytes } = input

      // 1. Extension. Cheapest possible check, and the one that catches the
      //    common "I dragged the wrong file" case.
      if (!fileName.toLowerCase().endsWith('.docx')) {
        return err(
          fileName.toLowerCase().endsWith('.doc')
            ? legacyFormatError(fileName)
            : notADocxError(fileName),
        )
      }

      // 2. Size, both directions.
      if (byteSize === 0 || bytes.byteLength === 0) {
        return err(emptyFileError(fileName))
      }

      if (byteSize > maxBytes) {
        return err(tooLargeError(fileName, formatFileSize(byteSize), formatFileSize(maxBytes, 0)))
      }

      // 3. Magic bytes — what the file actually is, regardless of its name.
      if (hasSignature(bytes, SIGNATURES.ole2)) {
        return err(
          containsAsciiMarker(bytes, ENCRYPTION_MARKER)
            ? encryptedError(fileName)
            : legacyFormatError(fileName),
        )
      }

      if (hasSignature(bytes, SIGNATURES.emptyZip)) {
        return err(missingDocumentXmlError(fileName))
      }

      if (!hasSignature(bytes, SIGNATURES.zip)) {
        return err(corruptError(fileName))
      }

      // 4. The archive must actually open. This is where a truncated download
      //    is caught: the header is intact but the central directory is not.
      let zip: JSZip
      try {
        zip = await JSZip.loadAsync(bytes)
      } catch (cause) {
        return err(corruptError(fileName, cause))
      }

      // 5. It must be a *Word* package, not just any ZIP with a .docx name.
      if (!zip.file(MAIN_DOCUMENT_PART)) {
        return err(missingDocumentXmlError(fileName))
      }

      return ok({ fileName, zip })
    },
  }
}
