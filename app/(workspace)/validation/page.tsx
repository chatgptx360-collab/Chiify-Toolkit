import type { Metadata } from 'next'

import { PageHeader } from '@/components/common/page-header'

import { ValidationWorkspace } from './_components/validation-workspace'

export const metadata: Metadata = {
  title: 'Validation',
  description: 'Specification, accessibility and retailer readiness checks.',
}

/**
 * The validation route.
 *
 * A server component holding the page metadata and heading, with the workspace
 * below it as a client island. The books being checked live in the browser, so
 * there is nothing for the server to render — but the title, description and
 * document metadata are static, and keeping them on the server is what stops
 * the whole page from being client-side.
 */
export default function ValidationPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Validation"
        description="Every generated book is checked against the specification, the accessibility rules retailers now enforce, and the requirements of the stores you are likely to submit to."
      />

      <ValidationWorkspace />
    </div>
  )
}
