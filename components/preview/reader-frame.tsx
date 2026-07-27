'use client'

import * as React from 'react'

import type { PreviewDevice } from '@/lib/preview'
import { cn } from '@/lib/utils'

/**
 * The book, rendered in a sandboxed frame.
 *
 * WHY AN IFRAME AND NOT `dangerouslySetInnerHTML`
 * -----------------------------------------------
 * Two reasons, and both matter.
 *
 * The first is fidelity. The book carries its own stylesheet, and the point of
 * the preview is to see what that stylesheet does. Injecting the markup into
 * this document would let the application's CSS reach it — Tailwind's reset
 * alone would silently change every margin — so the author would be shown
 * something that is not their book.
 *
 * The second is containment. The markup comes from a Word document, which is to
 * say from anywhere. `sandbox` with no allow flags means no scripts, no forms,
 * no navigation, no access to this page. A manuscript cannot reach the
 * application around it.
 *
 * WHY `srcDoc` AND NOT A URL
 * --------------------------
 * The book is in memory. Writing it to a blob URL would give the frame an
 * origin to argue with; `srcDoc` has none of that, and the whole page is a
 * single string React can diff.
 *
 * WHY THE DEVICE FRAME SCALES INSTEAD OF SHRINKING
 * ------------------------------------------------
 * The point of a 375-pixel preview is that the layout believes it is 375 pixels
 * wide. So the frame is always rendered at the device's real width and scaled
 * down visually to fit — a narrower frame would reflow the text and show a
 * layout the device will never produce.
 */

export interface ReaderFrameProps {
  /** A complete HTML document. */
  document: string | undefined
  device: PreviewDevice
  title: string
  className?: string
}

export function ReaderFrame({ document, device, title, className }: ReaderFrameProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [scale, setScale] = React.useState(1)

  // Fit the device width into whatever space the layout gives us, never
  // enlarging: a phone preview blown up to 900 pixels is not a phone preview.
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(([entry]) => {
      const available = entry?.contentRect.width ?? device.width
      setScale(Math.min(1, available / device.width))
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [device.width])

  return (
    <div ref={containerRef} className={cn('flex justify-center overflow-hidden', className)}>
      <div
        style={{
          width: device.width * scale,
          height: device.height * scale,
        }}
      >
        <iframe
          title={`${title} — preview at ${device.name} size`}
          srcDoc={document ?? ''}
          sandbox=""
          className="rounded-lg border border-border bg-white shadow-md"
          style={{
            width: device.width,
            height: device.height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  )
}
