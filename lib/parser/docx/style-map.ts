/**
 * Mammoth style map.
 *
 * WHY A CUSTOM MAP
 * ----------------
 * Mammoth's defaults target generic web output. A manuscript needs *semantic*
 * output, because the internal document model records meaning rather than
 * appearance. Two differences matter:
 *
 *   1. **Underline is preserved.** Mammoth discards it by default, on the sound
 *      general principle that underline on the web means "link". In a
 *      manuscript it usually means the author intended emphasis a typesetter
 *      would set in italics, and silently deleting an author's formatting is
 *      not ours to do. It is carried through as a mark; the export theme
 *      decides how to render it.
 *
 *   2. **Named Word styles become roles.** "Quote", "Epigraph", "Dedication"
 *      and friends map onto elements or `role` hints the model understands,
 *      so an author who used Word's styles properly gets that structure back.
 *
 * Unmapped styles fall through to plain paragraphs rather than failing. An
 * unrecognised style is a formatting nuance, never a reason to reject a book.
 *
 * The syntax is Mammoth's own: `source => target:fresh`. `:fresh` prevents
 * consecutive paragraphs collapsing into one element.
 */
export const DOCX_STYLE_MAP: string[] = [
  // Headings. Word's built-in names vary by locale, so the numbered styles are
  // matched by style id as well as by name.
  // Word's "Title" style is the *book's* title, not a chapter. Mapping it to a
  // heading would make the title page a chapter named after the book. It
  // becomes a paragraph with a role instead; the title itself is already
  // captured as embedded metadata.
  "p[style-name='Title'] => p.title:fresh",
  "p[style-name='Subtitle'] => p.subtitle:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",

  // Block-level semantics.
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "p[style-name='Block Text'] => blockquote > p:fresh",
  "p[style-name='Epigraph'] => p.epigraph:fresh",
  "p[style-name='Dedication'] => p.dedication:fresh",
  "p[style-name='Caption'] => p.caption:fresh",

  // Monospaced styles are the closest Word has to a code block.
  "p[style-name='Code'] => pre:separator('\\n')",
  "p[style-name='Source Code'] => pre:separator('\\n')",
  "p[style-name='HTML Preformatted'] => pre:separator('\\n')",
  "p[style-name='Plain Text'] => pre:separator('\\n')",

  // Inline marks. Underline is the meaningful addition; see the note above.
  'u => u',
  'strike => s',
  "r[style-name='Code Char'] => code",
  "r[style-name='Verbatim Char'] => code",
]

/**
 * Options passed to `mammoth.convertToHtml`.
 *
 * `includeDefaultStyleMap` stays on so the map above *extends* Mammoth's
 * defaults rather than replacing them — bold, italic, lists, tables and
 * hyperlinks already convert correctly and there is nothing to gain from
 * re-declaring them.
 */
export const MAMMOTH_OPTIONS = {
  // A fresh copy each read: Mammoth's typings take a mutable array, and handing
  // it the module-level constant would let it be mutated for every later parse.
  get styleMap(): string[] {
    return [...DOCX_STYLE_MAP]
  },
  includeDefaultStyleMap: true,
  /** Word writes an empty paragraph for a hard page break; keep it visible. */
  ignoreEmptyParagraphs: false,
} as const
