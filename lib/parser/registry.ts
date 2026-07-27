import { appError, err, ok, type Result } from '../utils/result'

import type { DocumentParser, ParseInput } from './types'

/**
 * Parser registry.
 *
 * WHY A REGISTRY RATHER THAN A `switch`
 * -------------------------------------
 * A `switch (extension)` in the upload handler would force every new input
 * format to edit UI-adjacent code — the open/closed principle violated in the
 * one place it hurts most. With a registry, Phase 3 registers the DOCX parser
 * and the upload experience needs no change; the eventual plugin system on the
 * roadmap becomes "call `registerParser` from a plugin" rather than a rewrite.
 *
 * The registry is intentionally a module-level map: parsers are stateless
 * singletons, and a single shared instance keeps the accepted-file-types list
 * consistent everywhere in the UI.
 */

const parsers = new Map<string, DocumentParser>()

/** Register (or replace) a parser. Returns an unregister function. */
export function registerParser(parser: DocumentParser): () => void {
  parsers.set(parser.id, parser)
  return () => {
    parsers.delete(parser.id)
  }
}

export function listParsers(): readonly DocumentParser[] {
  return [...parsers.values()]
}

export function getParser(id: string): DocumentParser | undefined {
  return parsers.get(id)
}

/**
 * Find the parser that claims a file.
 *
 * Returns a `Result` rather than `undefined` so the caller gets a message it
 * can show the user — "we don't support .pages yet" is a product answer, not
 * a null check.
 */
export function resolveParser(
  input: Pick<ParseInput, 'fileName' | 'mediaType'>,
): Result<DocumentParser> {
  for (const parser of parsers.values()) {
    if (parser.canParse(input)) return ok(parser)
  }

  return err(
    appError('parser.unsupported-format', `“${input.fileName}” is not a supported manuscript.`, {
      source: input.fileName,
      hint:
        listParsers().length > 0
          ? `Supported formats: ${acceptedExtensions().join(', ')}.`
          : 'No manuscript formats are available in this build.',
    }),
  )
}

/** Every extension currently accepted, for `<input accept>` and copy. */
export function acceptedExtensions(): readonly string[] {
  return [...new Set(listParsers().flatMap((parser) => parser.extensions))].sort()
}

/** Every media type currently accepted, for drag-and-drop filtering. */
export function acceptedMediaTypes(): readonly string[] {
  return [...new Set(listParsers().flatMap((parser) => parser.mediaTypes))].sort()
}
