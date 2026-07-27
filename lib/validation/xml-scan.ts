/**
 * A strict, dependency-free XML scanner.
 *
 * WHY VALIDATION PARSES MARKUP IT GENERATED ITSELF
 * ------------------------------------------------
 * The engine builds XHTML with `xmlbuilder2`, so in principle every document it
 * produces is well-formed. Validating it anyway is not paranoia:
 *
 *   - A validator that trusts its own generator only proves the generator is
 *     self-consistent. It cannot catch a regression in the generator, which is
 *     precisely the failure a reader would experience as "the book will not
 *     open".
 *   - Every structural check downstream — heading order, alt text, link
 *     targets, table headers — needs the elements anyway. Reading them once
 *     here and sharing the result is cheaper than seven inspectors each doing
 *     their own string matching.
 *   - When a later phase imports an existing EPUB rather than generating one,
 *     the markup will be someone else's, and this is where it gets checked.
 *
 * WHY NOT `DOMParser` OR `xmlbuilder2`
 * ------------------------------------
 * `DOMParser` is browser-only, which would make the validator untestable in
 * Node and unusable in a worker. `xmlbuilder2` parses, but reports the first
 * error by throwing — an author wants every problem in their book listed at
 * once, not one per run. This scanner collects errors and keeps going.
 *
 * The output is a flat element list rather than a tree. Every check the
 * inspectors perform is either "does an element with these attributes exist"
 * or "do these elements appear in this order", and both are simpler over a
 * flat list. `depth` is retained for the few checks that need containment.
 */

export interface XmlScanError {
  readonly message: string
  /** 1-based, so it matches what an editor shows. */
  readonly line: number
}

export interface XmlElement {
  /** As written, e.g. `epub:switch`. */
  readonly name: string
  /** Lowercased, prefix removed — what checks match against. */
  readonly localName: string
  /** Attribute names are lowercased; prefixes are kept (`xml:lang`). */
  readonly attributes: Readonly<Record<string, string>>
  /** Concatenated descendant text, whitespace preserved. */
  readonly text: string
  /** 0 for the root element. */
  readonly depth: number
  readonly line: number
}

export interface XmlScanResult {
  readonly elements: readonly XmlElement[]
  readonly errors: readonly XmlScanError[]
  /** Every `id` attribute value, for resolving fragment links. */
  readonly ids: ReadonlySet<string>
}

interface MutableElement {
  name: string
  localName: string
  attributes: Record<string, string>
  parts: string[]
  depth: number
  line: number
}

/** `&name;`, `&#123;` or `&#x1F;` — anything else is an unescaped ampersand. */
const ENTITY_REFERENCE = /^&(?:[a-zA-Z][\w.-]*|#\d+|#x[0-9a-fA-F]+);/

const WHITESPACE = new Set([' ', '\t', '\n', '\r'])

export function scanXml(source: string): XmlScanResult {
  const elements: MutableElement[] = []
  const errors: XmlScanError[] = []
  const open: MutableElement[] = []
  const ids = new Set<string>()

  let index = 0
  let line = 1

  /** Advance to `to`, keeping the line counter honest, and return the text. */
  const advance = (to: number): string => {
    const chunk = source.slice(index, Math.min(to, source.length))
    for (let i = 0; i < chunk.length; i += 1) if (chunk[i] === '\n') line += 1
    index = Math.min(to, source.length)
    return chunk
  }

  const fail = (message: string): void => {
    // One report per line per message: a malformed document should produce a
    // readable list, not thousands of near-identical entries.
    if (errors.some((error) => error.line === line && error.message === message)) return
    errors.push({ message, line })
  }

  const addText = (text: string): void => {
    if (text.length === 0) return
    for (const element of open) element.parts.push(text)
  }

  while (index < source.length) {
    const nextTag = source.indexOf('<', index)

    if (nextTag === -1) {
      const trailing = advance(source.length)
      checkEntities(trailing, fail)
      addText(trailing)
      break
    }

    if (nextTag > index) {
      const text = advance(nextTag)
      checkEntities(text, fail)
      addText(text)
    }

    if (source.startsWith('<?', index)) {
      const end = source.indexOf('?>', index)
      if (end === -1) {
        fail('A processing instruction is never closed.')
        advance(source.length)
        break
      }
      advance(end + 2)
      continue
    }

    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index)
      if (end === -1) {
        fail('A comment is never closed.')
        advance(source.length)
        break
      }
      advance(end + 3)
      continue
    }

    if (source.startsWith('<![CDATA[', index)) {
      const end = source.indexOf(']]>', index)
      if (end === -1) {
        fail('A CDATA section is never closed.')
        advance(source.length)
        break
      }
      const raw = source.slice(index + 9, end)
      advance(end + 3)
      addText(raw)
      continue
    }

    if (source.startsWith('<!', index)) {
      // A doctype. Its internal subset may contain `>`, so balance brackets.
      const end = findDoctypeEnd(source, index)
      if (end === -1) {
        fail('A doctype declaration is never closed.')
        advance(source.length)
        break
      }
      advance(end + 1)
      continue
    }

    const tagEnd = findTagEnd(source, index)

    if (tagEnd === -1) {
      fail('A tag is never closed — the document ends inside it.')
      advance(source.length)
      break
    }

    const startLine = line
    const raw = advance(tagEnd + 1)

    if (raw.startsWith('</')) {
      const name = raw.slice(2, -1).trim()
      closeElement(name, open, errors, startLine)
      continue
    }

    const selfClosing = raw.endsWith('/>')
    const inner = raw.slice(1, selfClosing ? -2 : -1)
    const parsed = parseTag(inner, startLine, fail)

    if (!parsed) continue

    const element: MutableElement = {
      name: parsed.name,
      localName: localNameOf(parsed.name),
      attributes: parsed.attributes,
      parts: [],
      depth: open.length,
      line: startLine,
    }

    elements.push(element)

    const id = parsed.attributes.id
    if (id) ids.add(id)

    if (!selfClosing) open.push(element)
  }

  for (const unclosed of open) {
    errors.push({
      message: `<${unclosed.name}> is opened but never closed.`,
      line: unclosed.line,
    })
  }

  return {
    elements: elements.map((element) => ({
      name: element.name,
      localName: element.localName,
      attributes: element.attributes,
      text: element.parts.join(''),
      depth: element.depth,
      line: element.line,
    })),
    errors,
    ids,
  }
}

/** The index of the `>` that ends a tag, ignoring `>` inside quoted values. */
function findTagEnd(source: string, start: number): number {
  let quote: string | null = null

  for (let i = start + 1; i < source.length; i += 1) {
    const character = source[i]

    if (quote) {
      if (character === quote) quote = null
      continue
    }

    if (character === '"' || character === "'") quote = character
    else if (character === '>') return i
  }

  return -1
}

/** Doctypes may carry an internal subset in brackets that contains `>`. */
function findDoctypeEnd(source: string, start: number): number {
  let depth = 0

  for (let i = start; i < source.length; i += 1) {
    const character = source[i]
    if (character === '[') depth += 1
    else if (character === ']') depth -= 1
    else if (character === '>' && depth <= 0) return i
  }

  return -1
}

interface ParsedTag {
  readonly name: string
  readonly attributes: Record<string, string>
}

function parseTag(
  inner: string,
  line: number,
  fail: (message: string) => void,
): ParsedTag | undefined {
  let cursor = 0

  while (cursor < inner.length && WHITESPACE.has(inner[cursor] ?? '')) cursor += 1

  const nameStart = cursor
  while (cursor < inner.length && !WHITESPACE.has(inner[cursor] ?? '')) cursor += 1

  const name = inner.slice(nameStart, cursor)

  if (name.length === 0) {
    fail('A tag has no element name.')
    return undefined
  }

  const attributes: Record<string, string> = {}

  while (cursor < inner.length) {
    while (cursor < inner.length && WHITESPACE.has(inner[cursor] ?? '')) cursor += 1
    if (cursor >= inner.length) break

    const attributeStart = cursor
    while (cursor < inner.length && !WHITESPACE.has(inner[cursor] ?? '') && inner[cursor] !== '=') {
      cursor += 1
    }

    const attributeName = inner.slice(attributeStart, cursor).toLowerCase()
    if (attributeName.length === 0) break

    while (cursor < inner.length && WHITESPACE.has(inner[cursor] ?? '')) cursor += 1

    if (inner[cursor] !== '=') {
      // XML has no boolean attributes; HTML's `<input disabled>` is invalid here.
      fail(`The attribute "${attributeName}" on <${name}> has no value.`)
      continue
    }

    cursor += 1
    while (cursor < inner.length && WHITESPACE.has(inner[cursor] ?? '')) cursor += 1

    const quote = inner[cursor]

    if (quote !== '"' && quote !== "'") {
      fail(`The value of "${attributeName}" on <${name}> is not quoted.`)
      while (cursor < inner.length && !WHITESPACE.has(inner[cursor] ?? '')) cursor += 1
      continue
    }

    cursor += 1
    const valueStart = cursor
    while (cursor < inner.length && inner[cursor] !== quote) cursor += 1

    const value = inner.slice(valueStart, cursor)
    cursor += 1

    if (attributeName in attributes) {
      fail(`<${name}> declares "${attributeName}" twice.`)
    }

    checkEntities(value, fail)
    attributes[attributeName] = decodeEntities(value)
  }

  void line

  return { name, attributes }
}

function closeElement(
  name: string,
  open: MutableElement[],
  errors: XmlScanError[],
  line: number,
): void {
  // Walk backwards rather than assuming the top of the stack matches, so a
  // document missing one close tag reports that fact instead of cascading.
  let matchIndex = -1
  for (let i = open.length - 1; i >= 0; i -= 1) {
    if (open[i]?.name === name) {
      matchIndex = i
      break
    }
  }

  if (matchIndex === -1) {
    errors.push({ message: `</${name}> closes an element that was never opened.`, line })
    return
  }

  for (let i = open.length - 1; i > matchIndex; i -= 1) {
    const skipped = open[i]
    if (skipped) {
      errors.push({
        message: `<${skipped.name}> is still open where </${name}> appears.`,
        line,
      })
    }
  }

  open.length = matchIndex
}

/**
 * Ampersands must introduce an entity reference.
 *
 * This is the single most common way a hand-built or template-generated EPUB
 * becomes unopenable: a title containing "Tom & Jerry" produces a package every
 * conforming reading system refuses, and the error message a device shows the
 * author is never about the ampersand.
 */
function checkEntities(text: string, fail: (message: string) => void): void {
  let from = 0

  for (;;) {
    const at = text.indexOf('&', from)
    if (at === -1) return

    if (!ENTITY_REFERENCE.test(text.slice(at, at + 12))) {
      fail('An ampersand is not written as an entity reference — it must be &amp;.')
      return
    }

    from = at + 1
  }
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => NAMED_ENTITIES[entity] ?? entity)
}

function localNameOf(name: string): string {
  const colon = name.indexOf(':')
  return (colon === -1 ? name : name.slice(colon + 1)).toLowerCase()
}
