'use client'

import type { PreviewChapter } from '@/lib/preview'
import { cn } from '@/lib/utils'

/**
 * The book's own table of contents, as navigation.
 *
 * WHY THIS IS BUILT FROM THE BOOK AND NOT FROM THE MANUSCRIPT
 * -----------------------------------------------------------
 * The entries and their labels come from the navigation document inside the
 * EPUB. So moving through the preview exercises the same structure a reader's
 * device will use — which means a mislabelled or missing chapter is visible
 * here, by using the preview normally, rather than only in a validation
 * finding.
 *
 * Pages outside the reading flow — the cover, the contents page itself — are
 * marked rather than hidden. They are part of the book, and an author checking
 * their cover should be able to open it.
 */

export interface ChapterListProps {
  chapters: readonly PreviewChapter[]
  currentHref: string | undefined
  onSelect: (href: string) => void
}

export function ChapterList({ chapters, currentHref, onSelect }: ChapterListProps) {
  return (
    <nav aria-label="Chapters">
      <ol className="space-y-0.5">
        {chapters.map((chapter, index) => {
          const current = chapter.href === currentHref

          return (
            <li key={chapter.href}>
              <button
                type="button"
                onClick={() => onSelect(chapter.href)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex w-full items-baseline gap-2 rounded-md px-2.5 py-1.5 text-left text-sm focus-ring motion-fast',
                  current
                    ? 'bg-primary-subtle font-medium text-primary-on-subtle'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="w-5 shrink-0 text-xs text-subtle-foreground tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                {!chapter.linear ? (
                  <span className="shrink-0 text-2xs text-subtle-foreground">extra</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
