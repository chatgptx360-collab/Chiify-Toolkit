/**
 * `lib/converter` — orchestration only.
 *
 * This module wires stages together and reports progress. It contains no
 * knowledge of DOCX and no knowledge of EPUB; both arrive as stages injected
 * by later phases. That is what lets the same runner drive PDF or Markdown
 * export on the roadmap without modification.
 *
 * Boundary rules:
 *   - May import from `lib/types` and `lib/utils`.
 *   - Must NOT import from `components` or React.
 */
export { createPipeline, defineStage, type Pipeline, type PipelineBuilder } from './pipeline'
export type {
  ConversionOutcome,
  ConversionProgress,
  ConversionRuntime,
  ConversionStage,
  ConversionStageId,
  ConversionStatus,
  RunPipelineOptions,
} from './types'
