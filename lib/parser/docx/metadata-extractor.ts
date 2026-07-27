import type JSZip from 'jszip'

import type { EmbeddedMetadata } from '../../types/document'

import { readAllElementText, readElementText, splitDelimited } from './xml'

/**
 * Extract the metadata Word stores inside the package.
 *
 * WHY THIS IS OFFERED, NOT APPLIED
 * --------------------------------
 * `docProps/core.xml` is filled in by Word from the operating system and the
 * document history. Its `dc:creator` is frequently the *machine's* account name
 * — "Windows User", an employer's name, the person who first opened a template
 * — and its `dc:title` is often a filename or an early working title.
 *
 * So this is a *suggestion engine*. The result never overwrites what an author
 * typed; the UI offers each value as a prefill they can accept. That is why
 * `EmbeddedMetadata` is a separate type from `BookMetadata` rather than the
 * parser writing straight into the project.
 *
 * Every field is optional and every failure is silent: absent metadata is the
 * normal case, not an error worth interrupting a conversion for.
 */
export interface MetadataExtractor {
  extract(zip: JSZip): Promise<EmbeddedMetadata>
}

const CORE_PART = 'docProps/core.xml'
const APP_PART = 'docProps/app.xml'

/**
 * Account names Word substitutes when no real author is set.
 *
 * Suggesting "Windows User" as the book's author is worse than suggesting
 * nothing, because an author skimming a prefilled form may not notice.
 */
const PLACEHOLDER_AUTHORS = new Set([
  'user',
  'windows user',
  'microsoft office user',
  'microsoft word',
  'unknown',
  'author',
  'admin',
  'administrator',
  'owner',
  'guest',
])

function isRealAuthor(name: string): boolean {
  return name.length > 1 && !PLACEHOLDER_AUTHORS.has(name.trim().toLowerCase())
}

export function createMetadataExtractor(): MetadataExtractor {
  return {
    async extract(zip) {
      const core = await readPart(zip, CORE_PART)
      const app = await readPart(zip, APP_PART)

      const metadata: {
        title?: string
        subtitle?: string
        authors?: readonly string[]
        description?: string
        publisher?: string
        language?: string
        keywords?: readonly string[]
        createdAt?: string
        modifiedAt?: string
      } = {}

      if (core) {
        const title = readElementText(core, 'dc:title')
        if (title) metadata.title = title

        const subject = readElementText(core, 'dc:subject')
        if (subject) metadata.subtitle = subject

        // `dc:creator` holds the primary author; `cp:lastModifiedBy` is an
        // editor and is deliberately ignored — it is rarely the author.
        const creator = readElementText(core, 'dc:creator')
        const authors = creator ? splitDelimited(creator).filter(isRealAuthor) : []
        if (authors.length > 0) metadata.authors = authors

        const description = readElementText(core, 'dc:description')
        if (description) metadata.description = description

        const language = readElementText(core, 'dc:language')
        if (language) metadata.language = language

        const keywords = readElementText(core, 'cp:keywords')
        if (keywords) {
          const parsed = splitDelimited(keywords)
          if (parsed.length > 0) metadata.keywords = parsed
        }

        const created = readElementText(core, 'dcterms:created')
        if (created) metadata.createdAt = created

        const modified = readElementText(core, 'dcterms:modified')
        if (modified) metadata.modifiedAt = modified
      }

      if (app) {
        // `Company` is the closest thing Word has to a publisher. Only used
        // when core.xml offered nothing better.
        const company = readElementText(app, 'Company')
        if (company && !metadata.publisher) metadata.publisher = company

        // Some templates put the real title in a custom "Title of Parts"
        // entry when dc:title is blank.
        if (!metadata.title) {
          const titleOfParts = readAllElementText(app, 'vt:lpstr')
          const candidate = titleOfParts.find((value) => value.length > 2)
          if (candidate) metadata.title = candidate
        }
      }

      return metadata
    },
  }
}

/**
 * Read a text part, returning `undefined` for anything unreadable.
 *
 * Metadata is optional by definition, so a damaged `docProps` part must never
 * fail a conversion — the manuscript is still perfectly readable without it.
 */
async function readPart(zip: JSZip, path: string): Promise<string | undefined> {
  const file = zip.file(path)
  if (!file) return undefined

  try {
    return await file.async('string')
  } catch {
    return undefined
  }
}
