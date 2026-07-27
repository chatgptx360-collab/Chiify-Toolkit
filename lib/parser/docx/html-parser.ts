/**
 * A small HTML parser for Mammoth's output.
 *
 * WHY NOT `DOMParser`
 * -------------------
 * `DOMParser` exists only in the browser. Using it would mean the parser cannot
 * run in Node — no unit tests without a DOM shim — and cannot run in a Web
 * Worker without extra plumbing, which is where Phase 6 wants to move it.
 * A parsing engine that only works inside a rendered page is the wrong shape
 * for this codebase.
 *
 * WHY NOT AN HTML LIBRARY
 * -----------------------
 * The input is not arbitrary web HTML. It is Mammoth's output: a small, closed
 * set of well-formed elements that Mammoth itself generates. There is no
 * tag-soup recovery to do, no implied end tags, no `<table>` fragment parsing
 * rules. A general parser would be several hundred kilobytes carried for a job
 * this file does in about a hundred lines.
 *
 * The scope is deliberately narrow: **this parses Mammoth output, not the web.**
 * It is not a sanitiser and must never be pointed at untrusted HTML.
 */

export interface HtmlText {
  readonly type: 'text'
  readonly text: string
}

export interface HtmlElement {
  readonly type: 'element'
  readonly tag: string
  readonly attributes: Readonly<Record<string, string>>
  readonly children: readonly HtmlNode[]
}

export type HtmlNode = HtmlText | HtmlElement

/** Elements that never have children or a closing tag. */
const VOID_ELEMENTS = new Set(['br', 'img', 'hr', 'wbr', 'col', 'input', 'meta', 'link'])

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' ',
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
}

/**
 * The element under construction.
 *
 * Carries `type: 'element'` from the moment it is created. The discriminant is
 * not decoration — every consumer narrows on it, so an element built without
 * one is invisible to `isElement` and its whole subtree is silently skipped.
 */
interface MutableElement {
  type: 'element'
  tag: string
  attributes: Record<string, string>
  children: HtmlNode[]
}

/**
 * Parse an HTML fragment into a node tree.
 *
 * Unbalanced closing tags are ignored rather than throwing: Mammoth does not
 * produce them, but a parser that crashes on unexpected input would turn a
 * cosmetic oddity into a failed conversion.
 */
export function parseHtml(html: string): readonly HtmlNode[] {
  const root: MutableElement = { type: 'element', tag: '#root', attributes: {}, children: [] }
  const stack: MutableElement[] = [root]
  let index = 0

  const current = (): MutableElement => stack[stack.length - 1] ?? root

  const pushText = (raw: string): void => {
    if (raw.length === 0) return
    current().children.push({ type: 'text', text: decodeEntities(raw) })
  }

  while (index < html.length) {
    const open = html.indexOf('<', index)

    if (open === -1) {
      pushText(html.slice(index))
      break
    }

    if (open > index) pushText(html.slice(index, open))

    // Comments and declarations carry nothing we need.
    if (html.startsWith('<!--', open)) {
      const end = html.indexOf('-->', open)
      index = end === -1 ? html.length : end + 3
      continue
    }

    if (html.startsWith('<!', open) || html.startsWith('<?', open)) {
      const end = html.indexOf('>', open)
      index = end === -1 ? html.length : end + 1
      continue
    }

    const close = findTagEnd(html, open)
    if (close === -1) {
      // A stray '<' in text. Treat it literally rather than losing the rest.
      pushText(html.slice(open))
      break
    }

    const raw = html.slice(open + 1, close)
    index = close + 1

    if (raw.startsWith('/')) {
      const tag = raw.slice(1).trim().toLowerCase()
      // Unwind to the nearest matching open tag. Ignoring an unmatched close is
      // safer than popping blindly, which would discard a whole subtree.
      let depth = -1
      for (let level = stack.length - 1; level > 0; level -= 1) {
        if (stack[level]?.tag === tag) {
          depth = level
          break
        }
      }
      if (depth > 0) stack.length = depth
      continue
    }

    const selfClosing = raw.endsWith('/')
    const body = selfClosing ? raw.slice(0, -1) : raw
    const { tag, attributes } = parseTag(body)
    if (!tag) continue

    const element: MutableElement = { type: 'element', tag, attributes, children: [] }
    current().children.push(element)

    if (!selfClosing && !VOID_ELEMENTS.has(tag)) stack.push(element)
  }

  return root.children
}

/**
 * Find the `>` that closes a tag, skipping any inside quoted attributes.
 *
 * Naively searching for `>` breaks on `alt="a > b"`, which is exactly the sort
 * of thing that appears in a real manuscript's image description.
 */
function findTagEnd(html: string, start: number): number {
  let quote: string | null = null

  for (let index = start + 1; index < html.length; index += 1) {
    const character = html[index]

    if (quote) {
      if (character === quote) quote = null
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      continue
    }

    if (character === '>') return index
  }

  return -1
}

/** Split a tag body into its name and attributes. */
function parseTag(body: string): { tag: string; attributes: Record<string, string> } {
  const match = /^([a-zA-Z][\w:-]*)/.exec(body.trim())
  if (!match?.[1]) return { tag: '', attributes: {} }

  const tag = match[1].toLowerCase()
  const attributes: Record<string, string> = {}
  const rest = body.trim().slice(match[1].length)

  const pattern = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

  for (const attribute of rest.matchAll(pattern)) {
    const name = attribute[1]?.toLowerCase()
    if (!name) continue
    attributes[name] = decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4] ?? '')
  }

  return { tag, attributes }
}

/** Concatenated text of a node and its descendants. */
export function textContent(node: HtmlNode): string {
  if (node.type === 'text') return node.text
  return node.children.map(textContent).join('')
}

/** Type guard, for readability at call sites. */
export function isElement(node: HtmlNode): node is HtmlElement {
  return node.type === 'element'
}
