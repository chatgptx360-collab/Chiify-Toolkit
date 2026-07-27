/**
 * Shared React hooks.
 *
 * A hook belongs here when it is generic (no domain knowledge) or when it is
 * the React binding for a `lib/` module. Hooks that exist to serve a single
 * component live beside that component.
 *
 * Note the direction of the dependency: hooks may read from `lib/`, but nothing
 * in `lib/` may import a hook. That is what keeps the domain testable without
 * a renderer.
 */
export { useDisclosure, type Disclosure } from './use-disclosure'
export { useKeyboardShortcut, type ShortcutOptions } from './use-keyboard-shortcut'
export { useLocalStorageBoolean } from './use-local-storage'
export { useBreakpoint, useIsMobileLayout, useMediaQuery } from './use-media-query'
export { useMounted } from './use-mounted'
export {
  useProject,
  useProjectActions,
  useProjects,
  useProjectsReady,
  type ProjectActions,
} from './use-projects'
export { useStableNow } from './use-stable-now'
export { useAnalysis, type AnalysisMetric, type AnalysisSummary } from './use-analysis'
export { useDocument, useDocumentActions, type DocumentActions } from './use-document'
export { useMetadata, type MetadataSuggestion, type UseMetadataResult } from './use-metadata'
export { useParser, type ParseStage, type ParseState, type UseParserResult } from './use-parser'
export { useUpload, type UploadResult } from './use-upload'
