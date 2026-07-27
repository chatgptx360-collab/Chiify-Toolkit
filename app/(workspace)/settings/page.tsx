import type { Metadata } from 'next'

import { PageHeader } from '@/components/common/page-header'
import { Section } from '@/components/common/section'
import { siteConfig } from '@/lib/config/site'

import { AppearanceSettings } from './_components/appearance-settings'
import { ConversionDefaults } from './_components/conversion-defaults'
import { DesignSystemPreview } from './_components/design-system-preview'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Defaults, appearance and workspace preferences.',
}

export default function SettingsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Settings"
        description="Workspace preferences and the defaults applied to every new project."
      />

      <Section
        title="Appearance"
        description="Chiify is dark by default. Your choice is stored on this device."
      >
        <AppearanceSettings />
      </Section>

      <Section
        title="Conversion defaults"
        description="Applied to new projects. Each project can override them."
      >
        <div className="space-y-4">
          <ConversionDefaults />

          <p className="text-xs text-subtle-foreground">
            These fields are disabled until project storage arrives in Phase 2. The wiring — labels,
            hints, validation messaging and the accessible relationships between them — is already
            in place.
          </p>
        </div>
      </Section>

      <Section
        title="Design system"
        description="Every primitive, rendered from the components the product actually uses."
      >
        <DesignSystemPreview />
      </Section>

      <Section title="About" description="Build information.">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">Version</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">{siteConfig.version}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">Phase</dt>
            <dd className="mt-1 text-sm font-medium">{siteConfig.phase}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">Target format</dt>
            <dd className="mt-1 text-sm font-medium">EPUB 3</dd>
          </div>
        </dl>
      </Section>
    </div>
  )
}
