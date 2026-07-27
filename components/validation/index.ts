/**
 * Validation UI.
 *
 * Presentation only. Every value these components render comes from a hook, and
 * none of them can change a book: the fix dialog raises a callback, and the
 * screen that owns the state decides what to do with it. That is what keeps
 * "never modify without showing the change first" a property of the system
 * rather than of one screen.
 */
export { CompatibilityMatrix, type CompatibilityMatrixProps } from './compatibility-matrix'
export { FindingList, type FindingListProps } from './finding-list'
export { FixDialog, type FixDialogProps } from './fix-dialog'
export { QualityScoreCard, type QualityScoreCardProps } from './quality-score'
