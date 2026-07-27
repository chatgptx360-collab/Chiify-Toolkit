import { createDocxParser } from './docx'
import { getParser, registerParser } from './registry'

/**
 * Install the parsers this build ships with.
 *
 * WHY REGISTRATION IS EXPLICIT
 * ----------------------------
 * A module with a side effect at import time is convenient right up to the
 * moment it is imported twice, or imported by a test that wanted the registry
 * empty. Calling this function makes installation an event with a caller, and
 * it is idempotent, so React's development double-render cannot register the
 * DOCX parser twice.
 *
 * Called from the client provider tree. Phase 4's export engines will have an
 * equivalent, and a plugin system is then "call `registerParser` from a
 * plugin" rather than a redesign.
 */
export function registerBuiltInParsers(): void {
  if (!getParser('docx')) {
    registerParser(createDocxParser())
  }
}
