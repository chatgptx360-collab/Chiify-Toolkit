/**
 * Barrel for shared utilities.
 *
 * Barrels exist at the *directory* level only (never per-file re-exports of
 * re-exports) so that `import { cn } from '@/lib/utils'` is the one obvious
 * import path, while each utility still lives in a focused module.
 */
export { cn } from './cn'
export {
  formatDate,
  formatFileSize,
  formatPercent,
  formatRelativeTime,
  formatWordCount,
  titleCase,
  truncate,
} from './format'
export { createId, slugify, uniqueSlug } from './slug'
export {
  appError,
  err,
  isErr,
  isOk,
  mapResult,
  ok,
  unwrapOr,
  type AppError,
  type Result,
  type Severity,
} from './result'
