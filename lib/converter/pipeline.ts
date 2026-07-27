import { appError, type AppError } from '../utils/result'

import type {
  ConversionOutcome,
  ConversionRuntime,
  ConversionStage,
  RunPipelineOptions,
} from './types'

/**
 * A type-safe, cancellable conversion pipeline.
 *
 * WHY BUILD THIS IN PHASE 1
 * -------------------------
 * The pipeline is the seam between phases. Phase 3 writes a `parse` stage,
 * Phase 4 writes `generate` and `package`, Phase 5 writes `validate`. If the
 * seam does not exist up front, each phase invents its own control flow and
 * Phase 6 spends its budget unifying them. Defining it now costs a hundred
 * lines and makes every later phase additive.
 *
 * What the runner guarantees so stages don't have to:
 *   - Cancellation is honoured at every stage boundary and surfaced as
 *     `cancelled`, not as an error.
 *   - Progress is weighted, monotonic and always ends at exactly 1.
 *   - A stage that throws is converted into a structured failure, so one
 *     misbehaving stage cannot take down the caller.
 *   - Non-fatal issues accumulate across stages and are returned even on
 *     success — a book can convert *and* have warnings.
 */

/** Opaque, ordered collection of stages with a checked input/output chain. */
export interface Pipeline<TInput, TOutput> {
  readonly stages: readonly ConversionStage<never, unknown>[]
  run(input: TInput, options?: RunPipelineOptions): Promise<ConversionOutcome<TOutput>>
}

/**
 * Builder that enforces stage compatibility at compile time.
 *
 * Usage (Phase 4):
 * ```ts
 * const pipeline = createPipeline<ParseInput>()
 *   .add(parseStage)      // ParseInput  -> ParsedDocument
 *   .add(generateStage)   // ParsedDocument -> EpubPackage
 *   .build()
 * ```
 * Adding a stage whose input does not match the previous stage's output is a
 * type error, not a runtime surprise.
 */
export interface PipelineBuilder<TInput, TCurrent> {
  add<TNext>(stage: ConversionStage<TCurrent, TNext>): PipelineBuilder<TInput, TNext>
  build(): Pipeline<TInput, TCurrent>
}

export function createPipeline<TInput>(): PipelineBuilder<TInput, TInput> {
  return builderWith<TInput, TInput>([])
}

function builderWith<TInput, TCurrent>(
  stages: readonly ConversionStage<never, unknown>[],
): PipelineBuilder<TInput, TCurrent> {
  return {
    add<TNext>(stage: ConversionStage<TCurrent, TNext>): PipelineBuilder<TInput, TNext> {
      return builderWith<TInput, TNext>([...stages, stage as ConversionStage<never, unknown>])
    },
    build(): Pipeline<TInput, TCurrent> {
      return {
        stages,
        run: (input, options) => runPipeline<TInput, TCurrent>(stages, input, options),
      }
    },
  }
}

async function runPipeline<TInput, TOutput>(
  stages: readonly ConversionStage<never, unknown>[],
  input: TInput,
  options: RunPipelineOptions = {},
): Promise<ConversionOutcome<TOutput>> {
  const { signal, onProgress } = options
  const issues: AppError[] = []

  if (stages.length === 0) {
    return { status: 'succeeded', value: input as unknown as TOutput, issues }
  }

  const totalWeight = stages.reduce((sum, stage) => sum + Math.max(stage.weight, 0), 0) || 1
  let completedWeight = 0
  let current: unknown = input

  for (const [index, stage] of stages.entries()) {
    if (signal?.aborted) {
      return { status: 'cancelled', issues }
    }

    const stageWeight = Math.max(stage.weight, 0)

    const emit = (stageRatio: number): void => {
      if (!onProgress) return
      const clamped = Math.min(Math.max(stageRatio, 0), 1)
      onProgress({
        stage: stage.id,
        stageLabel: stage.label,
        ratio: Math.min((completedWeight + stageWeight * clamped) / totalWeight, 1),
        stageIndex: index,
        stageCount: stages.length,
      })
    }

    const runtime: ConversionRuntime = {
      // A pipeline always has a signal from a stage's point of view, even when
      // the caller supplied none — that removes an `if` from every stage.
      signal: signal ?? new AbortController().signal,
      reportProgress: emit,
      reportIssue: (issue) => issues.push(issue),
    }

    emit(0)

    const result = await runStageSafely(stage, current, runtime)

    if (signal?.aborted) {
      return { status: 'cancelled', issues }
    }

    if (!result.ok) {
      return { status: 'failed', error: result.error, issues }
    }

    current = result.value
    completedWeight += stageWeight
    emit(1)
  }

  return { status: 'succeeded', value: current as TOutput, issues }
}

/**
 * Run a stage, converting a thrown exception into a structured failure.
 *
 * Stages are expected to return `err(...)` for domain problems; a throw means
 * a bug or an unexpected runtime fault, and the pipeline must still produce a
 * report rather than propagating a raw exception into a React render.
 */
async function runStageSafely(
  stage: ConversionStage<never, unknown>,
  input: unknown,
  runtime: ConversionRuntime,
) {
  try {
    return await stage.run(input as never, runtime)
  } catch (cause) {
    return {
      ok: false as const,
      error: appError('converter.stage-threw', `The “${stage.label}” step failed unexpectedly.`, {
        source: stage.id,
        hint: 'Try converting again. If it keeps failing, the manuscript may use an unsupported feature.',
        cause,
      }),
    }
  }
}

/** Convenience constructor that keeps stage definitions terse and consistent. */
export function defineStage<TInput, TOutput>(
  stage: ConversionStage<TInput, TOutput>,
): ConversionStage<TInput, TOutput> {
  return stage
}
