import { FileType2, Images, ListTree, Palette, ScanText, Upload, Wand2 } from 'lucide-react'
import type { Metadata } from 'next'

import { FeatureCard } from '@/components/cards/feature-card'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Section } from '@/components/common/section'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export const metadata: Metadata = {
  title: 'Converter',
  description: 'Turn a Word manuscript into a structured EPUB 3 book.',
}

/**
 * Converter.
 *
 * The pipeline stages listed here are the same six ids defined in
 * `lib/converter/types.ts`. Keeping the page honest about the real contract
 * means Phase 3 wires stages into an interface that already describes them,
 * rather than replacing an invented one.
 */
const PIPELINE_STAGES = [
  {
    id: 'read',
    title: 'Read',
    description: 'Open the .docx package and extract its document parts and embedded media.',
    phase: 'Phase 3',
  },
  {
    id: 'parse',
    title: 'Parse',
    description:
      'Map Word styles onto semantic blocks — headings, paragraphs, lists, quotes, tables and notes.',
    phase: 'Phase 3',
  },
  {
    id: 'analyse',
    title: 'Analyse',
    description:
      'Detect chapter boundaries, build the reading order and compute word counts and statistics.',
    phase: 'Phase 3',
  },
  {
    id: 'generate',
    title: 'Generate',
    description: 'Produce valid XHTML, a typographic stylesheet, navigation and package metadata.',
    phase: 'Phase 4',
  },
  {
    id: 'package',
    title: 'Package',
    description: 'Assemble the OCF container in the order the specification requires.',
    phase: 'Phase 4',
  },
  {
    id: 'validate',
    title: 'Validate',
    description: 'Check the finished book against EPUB 3 and accessibility rules before download.',
    phase: 'Phase 5',
  },
] as const

const CAPABILITIES = [
  {
    icon: ScanText,
    title: 'Structure detection',
    description:
      'Chapters are found from heading styles rather than page breaks, so front matter, body and back matter stay distinct.',
    statusLabel: 'Phase 3',
  },
  {
    icon: ListTree,
    title: 'Semantic conversion',
    description:
      'Word formatting becomes meaning: an italic run stays emphasis, a styled block stays a blockquote.',
    statusLabel: 'Phase 3',
  },
  {
    icon: Images,
    title: 'Image handling',
    description:
      'Embedded images are extracted, checked against the formats readers must support, and given alt text.',
    statusLabel: 'Phase 4',
  },
  {
    icon: Palette,
    title: 'Typographic themes',
    description:
      'Generated CSS follows a chosen theme, so the book reads well without overriding reader preferences.',
    statusLabel: 'Phase 4',
  },
]

export default function ConverterPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Converter"
        description="Upload a Microsoft Word manuscript and get a valid, retailer-ready EPUB 3 book."
        badge={{ label: 'Phase 3 – 4', intent: 'neutral' }}
        actions={
          <Button variant="primary" disabled>
            <Upload aria-hidden="true" />
            Upload manuscript
          </Button>
        }
      />

      <Alert intent="info">
        <AlertTitle>The conversion engine is not built yet</AlertTitle>
        <AlertDescription>
          Phase 1 establishes the pipeline contract that every conversion step plugs into. The
          stages below are already defined in the codebase — later phases supply their
          implementations without changing this screen&rsquo;s structure.
        </AlertDescription>
      </Alert>

      <EmptyState
        icon={FileType2}
        size="lg"
        title="Drop a .docx manuscript here"
        description="The upload experience arrives in Phase 2 and the parsing engine in Phase 3. Once both land, dropping a file here will start the pipeline shown below."
        action={
          <Button variant="outline" disabled>
            <Wand2 aria-hidden="true" />
            Choose a file
          </Button>
        }
      />

      <Section
        title="Conversion pipeline"
        description="Six stages, each independently testable and independently replaceable."
      >
        <Card>
          <CardHeader className="gap-3 pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle as="h3">Pipeline stages</CardTitle>
              <Badge intent="neutral" size="sm">
                Awaiting input
              </Badge>
            </div>
            <Progress value={0} label="Conversion progress" />
          </CardHeader>

          <CardContent>
            <ol className="divide-y divide-border">
              {PIPELINE_STAGES.map((stage, index) => (
                <li key={stage.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <span
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground tabular-nums"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{stage.title}</p>
                      <Badge size="sm" intent="neutral" tone="outline">
                        {stage.phase}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </Section>

      <Section title="What the converter will handle" description="Beyond plain text.">
        <div className="grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map((capability) => (
            <FeatureCard key={capability.title} {...capability} />
          ))}
        </div>
      </Section>
    </div>
  )
}
