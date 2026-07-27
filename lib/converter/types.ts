import type { AppError, Result } from '../utils/result'

/**
 * Conversion pipeline contracts.
 *
 * A conversion is a sequence of named stages, each transforming a context.
 * Phases 3–5 each contribute stages (parse → analyse → generate → package →
 * validate) without any of them knowing about the others.
 */

/** Stable stage identifiers, so progress UI can label steps before they run. */
export type ConversionStageId = 'read' | 'parse' | 'analyse' | 'generate' | 'package' | 'validate'

export type ConversionStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled'

/** Progress emitted after every stage boundary and on stage-internal ticks. */
export interface ConversionProgress {
  readonly stage: ConversionStageId
  readonly stageLabel: string
  /** Overall completion, 0–1, weighted across stages. */
  readonly ratio: number
  readonly stageIndex: number
  readonly stageCount: number
}

/** Environment handed to every stage. */
export interface ConversionRuntime {
  readonly signal: AbortSignal
  /** 0–1 within the current stage. */
  readonly reportProgress: (ratio: number) => void
  /** Non-fatal findings; collected and returned with the result. */
  readonly reportIssue: (issue: AppError) => void
}

/**
 * One step of the pipeline.
 *
 * Generic in both directions so stages compose with type safety: the output of
 * stage N must be assignable to the input of stage N+1, checked at compile time
 * by `createPipeline`.
 */
export interface ConversionStage<TInput, TOutput> {
  readonly id: ConversionStageId
  readonly label: string
  /**
   * Relative cost, used to weight the progress bar. A stage that takes ten
   * times as long as another should have ten times the weight, otherwise the
   * bar jumps — the single most common complaint about progress UI.
   */
  readonly weight: number
  run(input: TInput, runtime: ConversionRuntime): Promise<Result<TOutput>>
}

export interface ConversionOutcome<TValue> {
  readonly status: ConversionStatus
  readonly value?: TValue
  readonly error?: AppError
  /** Non-fatal problems gathered from every stage that ran. */
  readonly issues: readonly AppError[]
}

export interface RunPipelineOptions {
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: ConversionProgress) => void
}
