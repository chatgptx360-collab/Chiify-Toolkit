/**
 * `lib/documents` — session storage for parsed manuscripts.
 *
 * Deliberately thin. It holds the output of `lib/parser` so several screens can
 * read the same model without re-parsing, and nothing more: no parsing, no
 * export logic, no knowledge of what produced the document or what will consume
 * it.
 *
 * Boundary rules:
 *   - May import from `lib/types`.
 *   - Must NOT import from `lib/parser`, `lib/epub` or `components` — the store
 *     holds a model, and does not care which parser made it.
 */
export { createDocumentStore, documentStore, type DocumentStore } from './store'
