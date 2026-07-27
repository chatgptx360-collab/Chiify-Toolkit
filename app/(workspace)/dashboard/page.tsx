import { CheckCircle2, FileCheck2, FolderOpen, Wand2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { RoadmapCard } from '@/components/cards/roadmap-card'
import { PageHeader } from '@/components/common/page-header'
import { Section } from '@/components/common/section'
import { StatCard } from '@/components/dashboard/stat-card'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/lib/config/site'

import { LibraryOverview } from './_components/library-overview'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Library overview, recent activity and conversion health.',
}

/**
 * Dashboard.
 *
 * A Server Component holding the static half of the page — the delivery plan
 * and the quality gates. Everything derived from the project store lives in
 * `<LibraryOverview>`, a client island, so this route keeps its `metadata`
 * export and ships no more JavaScript than the data actually requires.
 */
const ROADMAP = [
  {
    phase: 'Phase 1',
    title: 'Foundation',
    description: 'Architecture, design system and application shell.',
    state: 'complete' as const,
    items: [
      'Design tokens and dark-first theming',
      'Reusable component library',
      'Responsive application shell',
      'Domain model and pipeline contracts',
    ],
  },
  {
    phase: 'Phase 2',
    title: 'Workspace',
    description: 'Projects, uploads and metadata capture.',
    state: 'complete' as const,
    items: [
      'Project creation, search and deletion',
      'Accessible manuscript upload',
      'Validated book metadata forms',
      'Dashboard driven by real data',
    ],
  },
  {
    phase: 'Phase 3 – 5',
    title: 'Conversion',
    description: 'Parsing, generation, validation and delivery.',
    state: 'active' as const,
    items: [
      'DOCX parsing and chapter detection',
      'EPUB 3 generation',
      'Reader preview and validation',
      'Download and error handling',
    ],
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Dashboard"
        description={siteConfig.tagline}
        badge={{ label: 'Phase 2 · Workspace', intent: 'primary' }}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/projects">
                <FolderOpen aria-hidden="true" />
                View projects
              </Link>
            </Button>
            <Button variant="primary" asChild>
              <Link href="/converter">
                <Wand2 aria-hidden="true" />
                Start a conversion
              </Link>
            </Button>
          </>
        }
      />

      <LibraryOverview />

      <Section
        title="Delivery plan"
        description="What is built, what is being built, and what comes next."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {ROADMAP.map((phase) => (
            <RoadmapCard key={phase.phase} {...phase} />
          ))}
        </div>
      </Section>

      <Section title="Quality gates" description="Every book is checked before it ships.">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Specification checks"
            value="EPUB 3.3"
            icon={FileCheck2}
            hint="Structure, manifest, navigation and metadata"
          />
          <StatCard
            label="Accessibility checks"
            value="WCAG 2.2 AA"
            icon={CheckCircle2}
            hint="Alt text, reading order, language and contrast"
          />
        </div>
      </Section>
    </div>
  )
}
