import { appError, type AppError } from '../../utils/result'
import type { ParseNotice } from '../../types/document'

/**
 * DOCX error vocabulary.
 *
 * Every failure the parser can produce is declared here, once, with the message
 * an author will read. Scattering `appError('...')` calls through the pipeline
 * produces inconsistent wording and codes that drift; a single table means the
 * validation screen, the toast and the future help centre all agree.
 *
 * Rules for the copy:
 *   - Name the file or the thing that went wrong. "Something failed" is useless.
 *   - Say what to *do*. Every fatal error carries a hint that is an action.
 *   - No jargon an author would not recognise. They did not write the XML.
 */

export const DOCX_ERROR = {
  notADocx: 'docx.not-a-docx',
  emptyFile: 'docx.empty-file',
  tooLarge: 'docx.too-large',
  corrupt: 'docx.corrupt',
  encrypted: 'docx.encrypted',
  legacyFormat: 'docx.legacy-format',
  missingDocumentXml: 'docx.missing-document-xml',
  malformedXml: 'docx.malformed-xml',
  emptyDocument: 'docx.empty-document',
  conversionFailed: 'docx.conversion-failed',
} as const

/** The file is not a DOCX at all. */
export function notADocxError(fileName: string): AppError {
  return appError(DOCX_ERROR.notADocx, `“${fileName}” is not a Word document.`, {
    source: fileName,
    hint: 'Chiify reads .docx files. In Word, choose File → Save As and pick “Word Document (.docx)”.',
  })
}

export function emptyFileError(fileName: string): AppError {
  return appError(DOCX_ERROR.emptyFile, `“${fileName}” is empty.`, {
    source: fileName,
    hint: 'Check the file opens in Word before uploading it.',
  })
}

export function tooLargeError(fileName: string, size: string, limit: string): AppError {
  return appError(DOCX_ERROR.tooLarge, `“${fileName}” is ${size}, over the ${limit} limit.`, {
    source: fileName,
    hint: 'Very large manuscripts are usually large because of uncompressed images. Compress them in Word (Picture Format → Compress Pictures) and try again.',
  })
}

/**
 * The bytes are not a readable ZIP.
 *
 * A `.docx` is a ZIP archive. If it will not open, the file is damaged — most
 * often by an interrupted download or a sync conflict, which is what the hint
 * addresses.
 */
export function corruptError(fileName: string, cause?: unknown): AppError {
  return appError(DOCX_ERROR.corrupt, `“${fileName}” appears to be damaged.`, {
    source: fileName,
    hint: 'Try opening it in Word and saving a fresh copy. If it came from a download or a cloud sync, download it again.',
    ...(cause === undefined ? {} : { cause }),
  })
}

/**
 * Password-protected or rights-managed.
 *
 * Encrypted Office files are OLE compound documents wrapping the real package,
 * so they are structurally a different format — there is nothing to read
 * without the password, and asking for one is out of scope.
 */
export function encryptedError(fileName: string): AppError {
  return appError(DOCX_ERROR.encrypted, `“${fileName}” is password protected.`, {
    source: fileName,
    hint: 'Open it in Word, remove the password under File → Info → Protect Document, then save and upload again.',
  })
}

/** A `.doc` (Word 97–2003) renamed, or genuinely old. */
export function legacyFormatError(fileName: string): AppError {
  return appError(DOCX_ERROR.legacyFormat, `“${fileName}” uses the old Word format.`, {
    source: fileName,
    hint: 'Open it in Word and save as “Word Document (.docx)”. The old .doc format cannot be read directly.',
  })
}

/** A valid ZIP, but not a Word package. */
export function missingDocumentXmlError(fileName: string): AppError {
  return appError(
    DOCX_ERROR.missingDocumentXml,
    `“${fileName}” does not contain a Word document.`,
    {
      source: fileName,
      hint: 'The file opens as an archive but has no manuscript inside. Re-save it from Word.',
    },
  )
}

export function malformedXmlError(fileName: string, part: string, cause?: unknown): AppError {
  return appError(DOCX_ERROR.malformedXml, `“${fileName}” contains damaged content.`, {
    source: part,
    hint: 'Open the file in Word and save a fresh copy. Word repairs most structural damage on save.',
    ...(cause === undefined ? {} : { cause }),
  })
}

export function emptyDocumentError(fileName: string): AppError {
  return appError(DOCX_ERROR.emptyDocument, `“${fileName}” has no text in it.`, {
    source: fileName,
    hint: 'The document opened correctly but contains no readable content. Check you uploaded the right file.',
  })
}

export function conversionFailedError(fileName: string, cause: unknown): AppError {
  return appError(DOCX_ERROR.conversionFailed, `“${fileName}” could not be read.`, {
    source: fileName,
    hint: 'The document uses a feature Chiify cannot interpret. Saving a fresh copy from Word usually resolves it.',
    cause,
  })
}

/**
 * Build a non-fatal notice.
 *
 * Notices are the parser's way of saying "this converted, but you should look
 * at it". They are data on the document, not errors, because a manuscript with
 * three images missing alt text is a successful parse with three things to fix.
 */
export function notice(
  code: string,
  message: string,
  options: { severity?: ParseNotice['severity']; source?: string; hint?: string } = {},
): ParseNotice {
  const { severity = 'warning', source, hint } = options

  return {
    code,
    message,
    severity,
    ...(source === undefined ? {} : { source }),
    ...(hint === undefined ? {} : { hint }),
  }
}
