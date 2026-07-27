import type { DocumentAsset, ParsedDocument } from '../types/document'
import type { AssetId } from '../types/common'
import type { EpubResource } from '../types/epub'

import { CORE_IMAGE_MEDIA_TYPES, OCF_PATHS } from './constants'
import { createNameRegistry, safeFileName, safeXmlId, type NameRegistry } from './naming'

/**
 * Asset management.
 *
 * Owns the mapping from a document asset to its place inside the container:
 * a unique filename, a manifest id, a path, and the media type the manifest
 * must declare. Everything downstream — the manifest, the XHTML `src`
 * attributes, the packager — reads that mapping rather than deriving names of
 * its own, which is what keeps every reference to an image consistent.
 *
 * It also decides which image is the cover. That decision belongs here rather
 * than in the metadata builder because the cover is *an asset that gets extra
 * properties*, not a separate concept.
 */

export interface PlacedAsset {
  readonly assetId: AssetId
  readonly resource: EpubResource
  readonly bytes: ArrayBuffer
  readonly isCover: boolean
}

export interface AssetManager {
  /** Every image, in document order, with its container placement. */
  readonly assets: readonly PlacedAsset[]
  /** Look up placement by the document model's asset id. */
  find(assetId: AssetId): PlacedAsset | undefined
  /** The cover image, if the book has one. */
  readonly cover: PlacedAsset | undefined
  /** Assets whose format reading systems are not required to support. */
  readonly nonCoreFormats: readonly PlacedAsset[]
}

export interface AssetManagerOptions {
  /**
   * Which image to use as the cover.
   *
   * Defaults to the first image in the book, which is the convention authors
   * expect from an illustrated manuscript. Passing an explicit id lets a later
   * phase add a cover picker without changing this service.
   */
  readonly coverAssetId?: AssetId
  /** Shares the registry with the chapter generator so names cannot collide. */
  readonly registry?: NameRegistry
}

export function createAssetManager(
  document: ParsedDocument,
  options: AssetManagerOptions = {},
): AssetManager {
  const registry = options.registry ?? createNameRegistry()
  const coverId = options.coverAssetId ?? firstReferencedImage(document)

  const placed = document.assets.map((asset): PlacedAsset => {
    const fileName = registry.claim(stripExtension(asset.fileName), extensionFor(asset), 'image')
    const href = `${IMAGE_DIRECTORY}/${fileName}`
    const isCover = asset.id === coverId

    return {
      assetId: asset.id,
      bytes: asset.bytes,
      isCover,
      resource: {
        id: safeXmlId(`img-${stripExtension(fileName)}`, 'img'),
        href,
        mediaType: asset.mediaType,
        // `cover-image` is how EPUB 3 identifies the cover. Retailers read it
        // to build a thumbnail, and a book without it shows a blank tile in a
        // reader's library.
        ...(isCover ? { properties: ['cover-image'] } : {}),
      },
    }
  })

  const byId = new Map(placed.map((asset) => [asset.assetId, asset]))

  return {
    assets: placed,
    find: (assetId) => byId.get(assetId),
    cover: placed.find((asset) => asset.isCover),
    nonCoreFormats: placed.filter(
      (asset) => !(CORE_IMAGE_MEDIA_TYPES as readonly string[]).includes(asset.resource.mediaType),
    ),
  }
}

/** Path inside the content root; hrefs elsewhere are resolved relative to it. */
const IMAGE_DIRECTORY = OCF_PATHS.imageDirectory.replace(`${OCF_PATHS.contentRoot}/`, '')

/**
 * The first image actually referenced by a block.
 *
 * Not simply `assets[0]`: the asset list is extraction order, which for a
 * manuscript with a header logo would make that logo the cover. Walking the
 * blocks finds the first image a *reader* would see.
 */
function firstReferencedImage(document: ParsedDocument): AssetId | undefined {
  for (const chapter of document.chapters) {
    for (const block of chapter.blocks) {
      if (block.type === 'image') return block.assetId
    }
  }

  return document.assets[0]?.id
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? name : name.slice(0, dot)
}

/**
 * Extension for an asset, taken from its media type rather than its name.
 *
 * The parser already assigned an extension, but the media type is the value the
 * manifest declares — deriving the extension from the same source keeps the two
 * from disagreeing, which is a validation error reading systems do enforce.
 */
function extensionFor(asset: DocumentAsset): string {
  const known: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
  }

  const fromType = known[asset.mediaType.toLowerCase()]
  if (fromType) return fromType

  const dot = asset.fileName.lastIndexOf('.')
  return dot === -1 ? '.bin' : asset.fileName.slice(dot).toLowerCase()
}

/** Convenience for callers that only need a safe name. */
export { safeFileName }
