import { BookOpen, Columns2, Smartphone, Type, Wand2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { FeatureCard } from '@/components/cards/feature-card'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Section } from '@/components/common/section'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SkeletonText } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Preview',
  description: 'Read the generated book exactly as a reading system will.',
}

const CAPABILITIES = [
  {
    icon: BookOpen,
    title: 'Faithful rendering',
    description:
      'The preview renders the generated XHTML and CSS directly, so what you read is what a reading system receives — not an approximation.',
    statusLabel: 'Phase 5',
  },
  {
    icon: Columns2,
    title: 'Chapter navigation',
    description:
      'Move through the book using the same navigation document that ships inside the EPUB, which is also how you spot a broken table of contents.',
    statusLabel: 'Phase 5',
  },
  {
    icon: Type,
    title: 'Reader controls',
    description:
      'Change font size, line height and measure to check the book stays readable under settings you do not control.',
    statusLabel: 'Phase 5',
  },
  {
    icon: Smartphone,
    title: 'Device widths',
    description:
      'Preview at phone, tablet and e-reader widths to catch images and tables that overflow on small screens.',
    statusLabel: 'Phase 5',
  },
]

export default function PreviewPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Preview"
        description="Check the finished book before it reaches a reader — or a retailer."
        badge={{ label: 'Phase 5', intent: 'neutral' }}
        actions={
          <Button variant="secondary" disabled>
            <BookOpen aria-hidden="true" />
            Open reader
          </Button>
        }
      />

      <EmptyState
        icon={BookOpen}
        size="lg"
        title="No book to preview"
        description="Convert a manuscript first. Once a book has been generated, it opens here in a reader that uses the same files the EPUB contains."
        action={
          <Button variant="outline" asChild>
            <Link href="/converter">
              <Wand2 aria-hidden="true" />
              Go to the converter
            </Link>
          </Button>
        }
      />

      <Section
        title="Reader layout"
        description="The shape the preview will take once a book is available."
      >
        <Card>
          <CardHeader className="pb-4">
            <CardTitle as="h3">Chapter view</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* A structural placeholder, not a loading state: it shows the
                measure and rhythm the reader will use. */}
            <div className="mx-auto max-w-(--container-prose) space-y-6" aria-hidden="true">
              <div className="space-y-3">
                <div className="h-6 w-1/3 rounded-full bg-muted" />
                <div className="h-3 w-1/5 rounded-full bg-muted/60" />
              </div>
              <SkeletonText lines={5} />
              <SkeletonText lines={4} />
            </div>
            <p className="text-center text-xs text-subtle-foreground">
              Reading measure is capped at 46rem — the range that keeps long-form text comfortable.
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section title="Preview capabilities" description="What you will be able to check.">
        <div className="grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map((capability) => (
            <FeatureCard key={capability.title} {...capability} />
          ))}
        </div>
      </Section>
    </div>
  )
}
