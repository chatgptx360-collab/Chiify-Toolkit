/**
 * A small `Result` type for fallible operations.
 *
 * WHY NOT EXCEPTIONS
 * ------------------
 * The conversion pipeline (Phase 3–5) fails in ways that are *expected*:
 * a malformed .docx, an unsupported image, an EPUB rule violation. Those are
 * data the UI must render — a list of problems the author can fix — not
 * crashes. Modelling them as values means:
 *
 *   - failure modes are visible in the type signature and cannot be forgotten;
 *   - a step can return several diagnostics without unwinding the stack;
 *   - the UI layer never needs a try/catch around domain logic.
 *
 * Exceptions remain the right tool for programmer errors and truly exceptional
 * runtime faults; they are not used for domain outcomes.
 */

export type Result<TValue, TError = AppError> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError }

/** Severity ladder shared by the converter, validator and UI. */
export type Severity = 'info' | 'warning' | 'error'

/**
 * A structured, user-presentable problem.
 *
 * `code` is stable and machine-readable (used for grouping and, later, help
 * links); `message` is written for an author, not a developer.
 */
export interface AppError {
  readonly code: string
  readonly message: string
  readonly severity: Severity
  /** Where the problem occurred, e.g. a chapter id or manifest path. */
  readonly source?: string
  /** What the author can do about it. */
  readonly hint?: string
  readonly cause?: unknown
}

export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value }
}

export function err<TError = AppError>(error: TError): Result<never, TError> {
  return { ok: false, error }
}

/** Build an `AppError` with `severity` defaulting to `error`. */
export function appError(
  code: string,
  message: string,
  options: Omit<Partial<AppError>, 'code' | 'message'> = {},
): AppError {
  const { severity = 'error', source, hint, cause } = options

  return {
    code,
    message,
    severity,
    ...(source === undefined ? {} : { source }),
    ...(hint === undefined ? {} : { hint }),
    ...(cause === undefined ? {} : { cause }),
  }
}

export function isOk<TValue, TError>(
  result: Result<TValue, TError>,
): result is { ok: true; value: TValue } {
  return result.ok
}

export function isErr<TValue, TError>(
  result: Result<TValue, TError>,
): result is { ok: false; error: TError } {
  return !result.ok
}

/** Map the success value, passing failures through untouched. */
export function mapResult<TValue, TNext, TError>(
  result: Result<TValue, TError>,
  transform: (value: TValue) => TNext,
): Result<TNext, TError> {
  return result.ok ? { ok: true, value: transform(result.value) } : result
}

/** Unwrap with a fallback, for call sites that cannot fail meaningfully. */
export function unwrapOr<TValue, TError>(result: Result<TValue, TError>, fallback: TValue): TValue {
  return result.ok ? result.value : fallback
}
