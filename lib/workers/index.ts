/**
 * `lib/workers` — runs the engines off the main thread.
 *
 * Boundary rules:
 *   - May import from `lib/parser`, `lib/epub`, `lib/types`, `lib/utils` and
 *     `lib/logging`.
 *   - Must NOT import from `components` or React.
 *   - The engines must not import from here. They do not know they are being
 *     run in a worker, which is what let this be added in one phase.
 *
 * Every import of an engine is dynamic, so mammoth, JSZip and xmlbuilder2 are
 * fetched when an author starts work rather than when a page loads.
 */
export {
  cancelledError,
  runGenerate,
  runParse,
  type GenerateInput,
  type ParseInput,
  type WorkerJob,
} from './client'

export { cloneableError, crashError } from './protocol'
export type {
  GenerateRequest,
  GenerateResponse,
  ParseRequest,
  ParseResponse,
  ProgressMessage,
} from './protocol'
