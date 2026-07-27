/**
 * Minimal XML text extraction.
 *
 * WHY NOT A REAL XML PARSER
 * -------------------------
 * This is used for exactly one job: pulling flat, single-level values out of
 * the `docProps/*.xml` parts, which are a fixed, tiny schema of leaf elements
 * (`<dc:title>…</dc:title>`). No nesting, no namespaces to resolve, no
 * attributes to interpret.
 *
 * `DOMParser` is browser-only, so using it would make the parser untestable in
 * Node and unusable in a worker without a shim. A full XML library would be a
 * dependency carried for a few dozen bytes of metadata. The document *body* is
 * not parsed here at all — Mammoth owns that, and it does use a real parser.
 *
 * The scope is deliberately narrow. If a future part needs nested or
 * attribute-bearing XML, it should get a proper parser rather than growing
 * these helpers.
 */

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
}

/** Decode the five XML entities plus numeric character references. */
export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => ENTITIES[entity] ?? entity)
}

/**
 * Text content of the first matching element.
 *
 * `tagName` may include a namespace prefix (`dc:title`). Elements are matched
 * case-sensitively, as XML requires. Returns `undefined` when absent or empty,
 * so callers can use `??` rather than testing for empty strings.
 */
export function readElementText(xml: string, tagName: string): string | undefined {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`)
  const match = pattern.exec(xml)
  if (!match?.[1]) return undefined

  const text = decodeXmlEntities(match[1]).trim()
  return text.length > 0 ? text : undefined
}

/** Text content of every matching element, in document order. */
export function readAllElementText(xml: string, tagName: string): readonly string[] {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`, 'g')
  const values: string[] = []

  for (const match of xml.matchAll(pattern)) {
    const text = decodeXmlEntities(match[1] ?? '').trim()
    if (text.length > 0) values.push(text)
  }

  return values
}

/**
 * Split a delimited metadata field into a list.
 *
 * Word writes multiple creators and keywords into a single element with no
 * agreed separator — semicolons, commas and " and " all appear in the wild,
 * depending on locale and on how the author typed it.
 */
export function splitDelimited(value: string): readonly string[] {
  return value
    .split(/[;,]|\sand\s/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}
