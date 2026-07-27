/**
 * Public type surface of the domain.
 *
 * Import from `@/lib/types` rather than reaching into individual files: the
 * grouping below is the stable contract, the file layout is an implementation
 * detail that later phases may reorganise.
 */

export type {
  AssetId,
  Brand,
  ChapterId,
  ConversionId,
  DeepReadonly,
  DocumentId,
  Intent,
  IsoDateTime,
  LoadState,
  ProjectId,
  WithOptional,
} from './common'
export { isoNow } from './common'

export type {
  Block,
  BlockAlignment,
  BlockType,
  Chapter,
  ChapterKind,
  CodeBlock,
  DividerBlock,
  DocumentAsset,
  DocumentStats,
  HeadingBlock,
  HeadingLevel,
  ImageBlock,
  ListBlock,
  ListItem,
  NoteBlock,
  PageBreakBlock,
  ParagraphBlock,
  ParsedDocument,
  QuoteBlock,
  TableBlock,
  TableCell,
  TableRow,
  TextMark,
  TextRun,
} from './document'

export type { BookMetadata, Project, ProjectSettings, ProjectStatus, SourceFile } from './project'
export { defaultBookMetadata, defaultProjectSettings } from './project'

export type {
  EpubAccessibility,
  EpubArtifact,
  EpubNavItem,
  EpubPackage,
  EpubResource,
  EpubSpineItem,
  EpubVersion,
} from './epub'

export type {
  ValidationCategory,
  ValidationIssue,
  ValidationReport,
  ValidationSummary,
} from './validation'
export { summariseIssues } from './validation'

export type { BreadcrumbItem, ComponentSize, NavItem, NavSection, Toast, ToastOptions } from './ui'
