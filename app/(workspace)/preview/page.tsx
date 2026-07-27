import type { Metadata } from 'next'

import { PageHeader } from '@/components/common/page-header'

import { PreviewWorkspace } from './_components/preview-workspace'

export const metadata: Metadata = {
  title: 'Preview',
  description: 'Read the generated book exactly as a reading system will.',
}

/**
 * The preview route.
 *
 * Server component for the heading and metadata; the reader itself is a client
 * island, because the book it renders exists only in the browser.
 */
export default function PreviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Preview"
        description="Read the finished book before a reader — or a retailer — does. The preview renders the exact XHTML and CSS inside the EPUB, at the screen sizes and reader settings you do not control."
      />

      <PreviewWorkspace />
    </div>
  )
}
