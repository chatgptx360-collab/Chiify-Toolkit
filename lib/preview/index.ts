/**
 * `lib/preview` — renders a generated EPUB for reading in the browser.
 *
 * Boundary rules:
 *   - May import from `lib/types`, `lib/utils` and `lib/epub` types.
 *   - Must NOT import from `lib/parser`, from `components`, or from React.
 *
 * It renders the exact files the download contains rather than re-deriving
 * anything from the document model, which is the only thing that makes a
 * preview trustworthy.
 */
export {
  DEFAULT_DEVICE_ID,
  DEFAULT_PREFERENCES,
  PREVIEW_DEVICES,
  READER_THEMES,
  deviceById,
  type PreviewDevice,
  type ReaderPreferences,
  type ReaderTheme,
} from './devices'

export {
  createPreviewRenderer,
  toBase64,
  type PreviewChapter,
  type PreviewRenderer,
  type PreviewRendererInput,
} from './renderer'
