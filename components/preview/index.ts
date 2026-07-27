/**
 * Preview UI.
 *
 * Presentation only. The renderer lives in `lib/preview` and these components
 * receive a finished HTML document — so the code that decides what a book looks
 * like has no idea a React tree exists, and the code that lays out the screen
 * has no idea what an EPUB is.
 */
export { ChapterList, type ChapterListProps } from './chapter-list'
export { ReaderControls, type ReaderControlsProps } from './reader-controls'
export { ReaderFrame, type ReaderFrameProps } from './reader-frame'
