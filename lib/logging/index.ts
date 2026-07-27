/**
 * `lib/logging` — structured logging.
 *
 * Importable from anywhere, including workers and `lib/` modules, because it
 * depends on nothing. See `logger.ts` for why production is quiet below `warn`
 * and why manuscript content is never logged.
 */
export {
  createLogger,
  logger,
  type LogLevel,
  type LogSink,
  type Logger,
  type LoggerOptions,
} from './logger'
