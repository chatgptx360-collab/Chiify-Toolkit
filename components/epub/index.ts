/**
 * EPUB components.
 *
 * Presentation only: they render whatever `useEpub` reports and never touch the
 * generator. Nothing here knows what an OPF, a manifest or a spine is — the
 * panel shows a progress bar and a download button.
 */
export { GenerationPanel, type GenerationPanelProps } from './generation-panel'
