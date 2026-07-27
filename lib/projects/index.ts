/**
 * `lib/projects` — the project workspace domain.
 *
 * Owns persistence and the rules that govern a project's data. Knows nothing
 * about React, and nothing about how a manuscript is parsed or a book is
 * generated.
 *
 * Boundary rules:
 *   - May import from `lib/types` and `lib/utils`.
 *   - Must NOT import from `lib/parser`, `lib/epub`, `lib/converter` or
 *     `components`.
 */
export {
  createLocalProjectStore,
  projectStore,
  type CreateProjectInput,
  type ProjectStore,
  type UpdateProjectInput,
} from './store'
export {
  blockingIssues,
  formatAuthors,
  issuesByField,
  parseAuthors,
  validateBookMetadata,
  type FieldIssue,
} from './validation'
export { projectStatusPresentation, type ProjectStatusPresentation } from './status'
