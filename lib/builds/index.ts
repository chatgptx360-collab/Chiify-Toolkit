/**
 * `lib/builds` — the most recent generated book for each project.
 *
 * A store rather than component state, because three screens need the same
 * build and none of them is a parent of the others. See `store.ts` for why it
 * is in memory and why the validation report lives alongside the book.
 */
export { buildStore, createBuildStore, type BuildRecord, type BuildStore } from './store'
