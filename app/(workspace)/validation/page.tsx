import { Accessibility, FileCheck2, ShieldCheck, Store, Wand2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { FeatureCard } from '@/components/cards/feature-card'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Section } from '@/components/common/section'
import { StatCard } from '@/components/dashboard/stat-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Validation',
  description: 'Specification, accessibility and retailer readiness checks.',
}

const CHECK_CATEGORIES = [
  {
    icon: FileCheck2,
    title: 'Specification',
    description:
      'Package document, manifest, spine and navigation are checked against EPUB 3, because a book that fails here is rejected at upload.',
    statusLabel: 'Phase 5',
  },
  {
    icon: Accessibility,
    title: 'Accessibility',
    description:
      'Alt text, reading order, document language and heading hierarchy — the fields retailers now require and readers depend on.',
    statusLabel: 'Phase 5',
  },
  {
    icon: ShieldCheck,
    title: 'Markup integrity',
    description:
      'Every generated XHTML file is checked for well-formedness and for links that point at resources the container actually holds.',
    statusLabel: 'Phase 5',
  },
  {
    icon: Store,
    title: 'Retailer readiness',
    description:
      'Store-specific rules for Kindle, Apple Books and Google Play, so a book passes before it is submitted rather than after.',
    statusLabel: 'Future',
  },
]

export default function ValidationPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Validation"
        description="Every generated book is checked before it can be downloaded."
        badge={{ label: 'Phase 5', intent: 'neutral' }}
        actions={
          <Button variant="secondary" disabled>
            <FileCheck2 aria-hidden="true" />
            Run checks
          </Button>
        }
      />

      <Alert intent="neutral">
        <AlertTitle>Severity is already modelled</AlertTitle>
        <AlertDescription>
          Findings are graded as errors, warnings or information, and a book passes when it has zero
          errors. That rule lives in the domain layer, so the dashboard, this page and any future
          export report can never disagree about what &ldquo;valid&rdquo; means.
        </AlertDescription>
      </Alert>

      <Section title="Last report" description="Results from the most recent validation run.">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Errors" value="0" hint="Must be fixed before publishing" />
          <StatCard label="Warnings" value="0" hint="Advisory — review before submission" />
          <StatCard label="Information" value="0" hint="Notes about the generated book" />
        </div>
      </Section>

      <EmptyState
        icon={ShieldCheck}
        title="Nothing has been validated yet"
        description="Convert a manuscript to produce a book, and its full report — grouped by category and severity, with a concrete fix for each finding — will appear here."
        action={
          <Button variant="outline" asChild>
            <Link href="/converter">
              <Wand2 aria-hidden="true" />
              Go to the converter
            </Link>
          </Button>
        }
      />

      <Section title="What gets checked" description="Four categories, run on every build.">
        <div className="grid gap-4 sm:grid-cols-2">
          {CHECK_CATEGORIES.map((category) => (
            <FeatureCard key={category.title} {...category} />
          ))}
        </div>
      </Section>
    </div>
  )
}
