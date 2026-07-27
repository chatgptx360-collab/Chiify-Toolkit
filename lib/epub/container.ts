import { create } from 'xmlbuilder2'

import { EPUB_MEDIA_TYPE, OCF_PATHS, XML_NAMESPACES } from './constants'

/**
 * The OCF container files.
 *
 * Two small files that every EPUB must contain, and both are unforgiving.
 */

/**
 * The `mimetype` file's contents.
 *
 * Exactly this string, with **no trailing newline and no byte-order mark**.
 * The OCF specification defines the first bytes of the archive precisely so
 * that a reader can identify an EPUB without unzipping it, and a stray newline
 * is enough to fail validation. It must also be the first entry in the zip and
 * stored uncompressed — see the packager, which is where that is enforced.
 */
export const MIMETYPE_CONTENT = EPUB_MEDIA_TYPE

/**
 * `META-INF/container.xml`.
 *
 * The one file at a fixed, known path. It exists solely to say where the
 * package document lives — everything else in the container is found from
 * there, which is what allows the content root to be named anything.
 */
export function buildContainerXml(packageDocumentPath = OCF_PATHS.packageDocument): string {
  // The path in container.xml is relative to the *archive root*, not to
  // META-INF: `OEBPS/content.opf`, not `../OEBPS/content.opf`.
  const document = create({ version: '1.0', encoding: 'UTF-8' })
    .ele(XML_NAMESPACES.container, 'container')
    .att('version', '1.0')

  document
    .ele('rootfiles')
    .ele('rootfile')
    .att('full-path', packageDocumentPath)
    .att('media-type', 'application/oebps-package+xml')
    .up()
    .up()

  return document.end({ prettyPrint: true, indent: '  ' })
}
