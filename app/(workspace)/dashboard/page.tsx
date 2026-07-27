import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  FolderOpen,
  Layers,
  Sparkles,
  Wand2,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { RoadmapCard } from '@/components/cards/roadmap-card'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Section } from '@/components/common/section'
import { StatCard } from '@/components/dashboard/stat-card'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/lib/config/site'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Library overview, recent activity and conversion health.',
}

/**
 * Dashboard.
 *
 * The statistics read zero because there is genuinely no data yet — showing
 * invented numbers would make the shell feel finished while hiding the fact
 * that the data layer does not exist. Zero states are the honest version, and
 * they exercise the same components the real values will use.
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
    state: 'active' as const,
    items: [
      'Project creation and management',
      'Manuscript upload experience',
      'Book metadata forms',
      'Dashboard with live data',
    ],
  },
  {
    phase: 'Phase 3 – 5',
    title: 'Conversion',
    description: 'Parsing, generation, validation and delivery.',
    state: 'upcoming' as const,
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
        badge={{ label: 'Phase 1 · Foundation', intent: 'primary' }}
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

      <Section title="Overview" description="Your publishing activity at a glance.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Projects"
            value="0"
            icon={FolderOpen}
            hint="Manuscripts in your workspace"
          />
          <StatCard
            label="Books converted"
            value="0"
            icon={BookOpen}
            hint="EPUB 3 files generated"
          />
          <StatCard
            label="Validation passes"
            value="0"
            icon={CheckCircle2}
            hint="Books that cleared every check"
          />
          <StatCard label="Words processed" value="0" icon={Layers} hint="Across all manuscripts" />
        </div>
      </Section>

      <Section
        title="Recent activity"
        description="Conversions, validations and downloads will appear here."
      >
        <EmptyState
          icon={Sparkles}
          title="Nothing to show yet"
          description="Once project management arrives in Phase 2, every upload, conversion and validation run will be listed here with its outcome."
          action={
            <Button variant="outline" asChild>
              <Link href="/converter">
                Explore the converter
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      </Section>

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
