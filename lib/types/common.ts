/**
 * Primitives shared by every domain model.
 *
 * Branded id types are used instead of bare `string`. The cost is one cast at
 * the boundary where an id is created; the benefit is that passing a
 * `ChapterId` where a `ProjectId` belongs becomes a compile error rather than
 * a runtime lookup that silently returns `undefined`.
 */

declare const brand: unique symbol

export type Brand<TValue, TBrand extends string> = TValue & { readonly [brand]: TBrand }

export type ProjectId = Brand<string, 'ProjectId'>
export type DocumentId = Brand<string, 'DocumentId'>
export type ChapterId = Brand<string, 'ChapterId'>
export type AssetId = Brand<string, 'AssetId'>
export type ConversionId = Brand<string, 'ConversionId'>

/** ISO-8601 timestamp. Stored as a string so models stay serialisable. */
export type IsoDateTime = Brand<string, 'IsoDateTime'>

export function isoNow(date: Date = new Date()): IsoDateTime {
  return date.toISOString() as IsoDateTime
}

/** Recursively read-only view of a model, for props that must not be mutated. */
export type DeepReadonly<T> = T extends (infer TItem)[]
  ? ReadonlyArray<DeepReadonly<TItem>>
  : T extends object
    ? { readonly [TKey in keyof T]: DeepReadonly<T[TKey]> }
    : T

/** Make selected keys optional — handy for `create*` input shapes. */
export type WithOptional<T, TKeys extends keyof T> = Omit<T, TKeys> & Partial<Pick<T, TKeys>>

/** Anything the UI can label with a colour intent. */
export type Intent = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

/** Standard async lifecycle used by hooks, cards and skeleton states. */
export type LoadState = 'idle' | 'loading' | 'success' | 'error'
