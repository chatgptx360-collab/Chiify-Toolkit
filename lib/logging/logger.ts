/**
 * Structured logging.
 *
 * WHY A LOGGER AND NOT `console.log`
 * ----------------------------------
 * Three reasons, in order of how much they matter.
 *
 * **Production silence.** A local-first application logs about the visitor's
 * own manuscript — file names, chapter titles, metadata. None of that belongs
 * in a console the visitor did not open, and a stray `console.log` in a
 * shipped build is how a debugging aid becomes a small privacy problem. Below
 * `warn`, nothing is emitted in production at all.
 *
 * **Timing you can act on.** Every expensive operation reports how long it
 * took. `logger.time()` returns a function to call when the work finishes, so
 * measuring is one line at each end rather than a pair of variables and a
 * subtraction — which is the difference between measurements that exist and
 * measurements somebody meant to add.
 *
 * **A consistent shape.** One prefix, one level, one place to change when logs
 * need to go somewhere other than the console.
 *
 * WHY NOT A LOGGING LIBRARY
 * -------------------------
 * The requirement is four levels, a namespace and a timer. Every library that
 * does this also does transports, serialisers and child loggers, and would be
 * carried into a bundle that is already the thing being optimised.
 *
 * WHAT IS DELIBERATELY NOT LOGGED
 * -------------------------------
 * Manuscript content. Statistics about it are fine — chapter counts, byte
 * sizes, durations — but no headings, no metadata values, and never the text
 * itself. A log line is the easiest thing in a codebase to copy somewhere it
 * should not go.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
}

export interface Logger {
  debug(message: string, ...details: unknown[]): void
  info(message: string, ...details: unknown[]): void
  warn(message: string, ...details: unknown[]): void
  error(message: string, ...details: unknown[]): void
  /**
   * Start a timer. Call the returned function when the work finishes; it
   * reports the elapsed milliseconds at debug level and returns them, so a
   * caller that wants the number for something else already has it.
   */
  time(label: string): () => number
  /** A logger that prefixes every line with its own namespace. */
  child(namespace: string): Logger
}

export interface LoggerOptions {
  readonly level: LogLevel
  readonly namespace?: string
  /** Injected so the tests can assert on output without a console. */
  readonly sink?: LogSink
  /** Injected so timings are deterministic in tests. */
  readonly now?: () => number
}

export interface LogSink {
  (level: Exclude<LogLevel, 'silent'>, message: string, details: readonly unknown[]): void
}

const consoleSink: LogSink = (level, message, details) => {
  // `console.debug` is hidden by default in some browsers' filters, which is
  // the correct place for verbose output to end up.
  // The one place in the codebase permitted to reach the console. The lint rule
  // exists to stop stray `console.log` reaching production; this module is what
  // that rule pushes people towards, and it silences itself in production.
  /* eslint-disable no-console */
  const write =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'info'
          ? console.info
          : console.debug
  /* eslint-enable no-console */

  write(message, ...details)
}

export function createLogger(options: LoggerOptions): Logger {
  const { level, namespace, sink = consoleSink, now = defaultNow } = options
  const threshold = LEVEL_ORDER[level]
  const prefix = namespace ? `[chiify:${namespace}]` : '[chiify]'

  const write = (
    logLevel: Exclude<LogLevel, 'silent'>,
    message: string,
    details: readonly unknown[],
  ): void => {
    if (LEVEL_ORDER[logLevel] < threshold) return
    sink(logLevel, `${prefix} ${message}`, details)
  }

  return {
    debug: (message, ...details) => write('debug', message, details),
    info: (message, ...details) => write('info', message, details),
    warn: (message, ...details) => write('warn', message, details),
    error: (message, ...details) => write('error', message, details),

    time(label) {
      const started = now()
      let stopped = false
      let elapsed = 0

      return () => {
        // Guarded because a job that finishes and is then cancelled would
        // otherwise report the time to the cancellation instead.
        if (!stopped) {
          stopped = true
          elapsed = Math.round(now() - started)
          write('debug', `${label} took ${elapsed}ms`, [])
        }

        return elapsed
      }
    },

    child(childNamespace) {
      return createLogger({
        level,
        namespace: namespace ? `${namespace}:${childNamespace}` : childNamespace,
        sink,
        now,
      })
    },
  }
}

function defaultNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

/**
 * The level this build logs at.
 *
 * Production keeps warnings and errors — those describe something the visitor
 * may be experiencing, and a browser console is where a bug report comes from.
 * Everything below is development only.
 *
 * `NEXT_PUBLIC_LOG_LEVEL` overrides it, which is how you get debug output from
 * a production build when diagnosing something that only happens there.
 */
function resolveLevel(): LogLevel {
  const configured = process.env.NEXT_PUBLIC_LOG_LEVEL

  if (configured && configured in LEVEL_ORDER) return configured as LogLevel

  return process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
}

/** The application logger. Use `logger.child('parser')` for a namespaced one. */
export const logger: Logger = createLogger({ level: resolveLevel() })
