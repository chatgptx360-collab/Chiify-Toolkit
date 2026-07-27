import {
  ArrowRight,
  Copy,
  FileText,
  FolderOpen,
  History,
  Plus,
  Settings2,
  Tags,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { FeatureCard } from '@/components/cards/feature-card'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Section } from '@/components/common/section'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Every manuscript you are preparing for publication.',
}

const CAPABILITIES = [
  {
    icon: FileText,
    title: 'Manuscript library',
    description:
      'Every book you are working on, with its source file, word count and conversion status in one list.',
    statusLabel: 'Phase 2',
  },
  {
    icon: Tags,
    title: 'Book metadata',
    description:
      'Title, authors, language, publisher and identifiers — captured once and written into every format you export.',
    statusLabel: 'Phase 2',
  },
  {
    icon: Settings2,
    title: 'Per-project settings',
    description:
      'Choose which heading level starts a chapter, whether to build a table of contents, and which typographic theme to apply.',
    statusLabel: 'Phase 2',
  },
  {
    icon: Copy,
    title: 'Duplicate and template',
    description:
      'Start a new book from an existing project so a series keeps consistent metadata and styling.',
    statusLabel: 'Phase 2',
  },
  {
    icon: History,
    title: 'Version history',
    description:
      'Keep every generated build so you can compare output and roll back to a version a retailer already accepted.',
    statusLabel: 'Future',
  },
  {
    icon: FolderOpen,
    title: 'Cloud sync',
    description:
      'Optional accounts that keep your library available across devices, with local-first storage as the default.',
    statusLabel: 'Future',
  },
]

export default function ProjectsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Projects"
        description="A project holds one manuscript, its metadata and every file generated from it."
        badge={{ label: 'Phase 2', intent: 'neutral' }}
        actions={
          <Button variant="primary" disabled>
            <Plus aria-hidden="true" />
            New project
          </Button>
        }
      />

      <EmptyState
        icon={FolderOpen}
        size="lg"
        title="Your library is empty"
        description="Project management arrives in Phase 2. When it does, this is where every manuscript you are preparing will live — each with its own metadata, settings and conversion history."
        action={
          <Button variant="outline" asChild>
            <Link href="/converter">
              See what the converter will do
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <Section
        title="What projects will do"
        description="The capabilities this area is being built to support."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CAPABILITIES.map((capability) => (
            <FeatureCard key={capability.title} {...capability} />
          ))}
        </div>
      </Section>
    </div>
  )
}
