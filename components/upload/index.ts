/**
 * Upload components.
 *
 * These handle file *selection and validation* only. Reading a manuscript's
 * contents is the parser's job (Phase 3) and is deliberately not done here —
 * the dropzone stays useful whichever formats are eventually supported, because
 * it asks `lib/parser` what is accepted rather than hardcoding it.
 */
export { ManuscriptDropzone, type ManuscriptDropzoneProps } from './manuscript-dropzone'
