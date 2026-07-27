import type { EpubResource } from '../types/epub'

import { OCF_PATHS } from './constants'
import type { AssetManager } from './asset-manager'
import { relativeHref } from './naming'
import { STYLESHEET_HREF } from './stylesheet-generator'
import { createXhtmlDocument } from './xhtml-generator'
import type { GeneratedFile, GenerationContext } from './types'

/**
 * The cover page.
 *
 * WHY A BOOK ALWAYS GETS ONE
 * --------------------------
 * A reader's library is a grid of thumbnails. A book with no cover shows a
 * blank tile, which reads as a broken file long before anyone opens it. So a
 * cover page is generated either way:
 *
 *   - **With a cover image**, the page is the image alone, sized to the
 *     viewport.
 *   - **Without one**, the page is a typographic title page — title, subtitle,
 *     author. Plain, but identifiably the book.
 *
 * WHY `linear="no"`
 * -----------------
 * The cover sits outside the main reading flow. Marking it non-linear stops a
 * reading system paging into it from the end of the previous section, and lets
 * "go to the beginning" mean the first chapter rather than the cover.
 *
 * The image itself is *not* placed in a `figure`: a cover is not an
 * illustration of anything, and wrapping it would give screen readers a
 * caption relationship that does not exist.
 */

const TEXT_DIRECTORY = OCF_PATHS.textDirectory.replace(`${OCF_PATHS.contentRoot}/`, '')
const COVER_HREF = `${TEXT_DIRECTORY}/cover.xhtml`

export interface CoverGeneratorOptions {
  readonly assets: AssetManager
}

export function buildCoverPage(
  context: GenerationContext,
  options: CoverGeneratorOptions,
): GeneratedFile {
  const language = context.metadata.language || 'en'
  const title = context.metadata.title || 'Untitled'
  const cover = options.assets.cover

  const document = createXhtmlDocument(language, title, relativeHref(COVER_HREF, STYLESHEET_HREF))

  const body = document.ele('body').att('class', 'cover-page')
  const section = body.ele('section').att('epub:type', 'cover').att('role', 'doc-cover')

  if (cover) {
    const image = section
      .ele('img')
      .att('src', relativeHref(COVER_HREF, cover.resource.href))
      // The alt text names the book rather than describing the artwork: a
      // reader using a screen reader needs to know which book this is, and
      // nobody can describe a cover they have not seen.
      .att('alt', `Cover of ${title}`)
      .att('class', 'cover-image')

    const asset = context.document.assets.find((item) => item.id === cover.assetId)
    if (asset?.width) image.att('width', String(asset.width))
    if (asset?.height) image.att('height', String(asset.height))
    image.up()
  } else {
    section.ele('h1').att('class', 'cover-title').txt(title).up()

    if (context.metadata.subtitle) {
      section.ele('p').att('class', 'cover-subtitle').txt(context.metadata.subtitle).up()
    }

    const authors = context.metadata.authors.filter(Boolean)
    if (authors.length > 0) {
      section.ele('p').att('class', 'cover-author').txt(authors.join(' and ')).up()
    }
  }

  section.up()
  body.up()

  const resource: EpubResource = {
    id: 'cover-page',
    href: COVER_HREF,
    mediaType: 'application/xhtml+xml',
  }

  return { resource, content: document.end({ prettyPrint: true, indent: '  ' }) }
}

export { COVER_HREF }
