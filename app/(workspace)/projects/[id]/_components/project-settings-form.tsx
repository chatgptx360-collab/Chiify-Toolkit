'use client'

import { FormField } from '@/components/forms/form-field'
import { FormSection } from '@/components/forms/form-section'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { useProjectActions } from '@/hooks'
import type { Project, ProjectSettings } from '@/lib/types'

/**
 * Per-project conversion settings.
 *
 * WHY THESE SAVE IMMEDIATELY WHILE METADATA DOES NOT
 * --------------------------------------------------
 * Each setting here is independent and instantly reversible — flipping "build a
 * table of contents" cannot leave the project in a half-valid state, so a Save
 * button would be ceremony. Metadata is the opposite: the fields validate
 * together, so it commits as a unit.
 *
 * That is the rule this codebase follows for the distinction, rather than
 * deciding case by case: **independent and reversible saves immediately;
 * interdependent or validated commits on submit.**
 */
const HEADING_LEVELS = [
  { value: '1', label: 'Heading 1', hint: 'Most manuscripts' },
  { value: '2', label: 'Heading 2', hint: 'When Heading 1 is the book title' },
  { value: '3', label: 'Heading 3', hint: 'Deeply nested manuscripts' },
] as const

const THEMES = [
  { value: 'classic', label: 'Classic — serif, traditional book feel' },
  { value: 'modern', label: 'Modern — sans-serif, generous spacing' },
  { value: 'compact', label: 'Compact — tighter leading, fewer pages' },
] as const

export interface ProjectSettingsFormProps {
  project: Project
}

export function ProjectSettingsForm({ project }: ProjectSettingsFormProps) {
  const { update } = useProjectActions()
  const { toast } = useToast()

  function save(changes: Partial<ProjectSettings>) {
    const result = update(project.id, { settings: changes })
    if (!result.ok) {
      toast({ title: 'Could not save', description: result.error.message, intent: 'danger' })
    }
  }

  return (
    <div className="space-y-4">
      <FormSection
        title="Structure"
        description="How the manuscript is divided into chapters."
        columns={2}
      >
        <FormField
          label="Chapter heading level"
          hint="Which Word heading style begins a new chapter."
        >
          {(field) => (
            <Select
              {...field}
              value={String(project.settings.chapterHeadingLevel)}
              onChange={(event) =>
                save({
                  chapterHeadingLevel: Number(
                    event.target.value,
                  ) as ProjectSettings['chapterHeadingLevel'],
                })
              }
            >
              {HEADING_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} — {level.hint}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Typographic theme" hint="Applied to the generated stylesheet.">
          {(field) => (
            <Select
              {...field}
              value={project.settings.theme}
              onChange={(event) => save({ theme: event.target.value })}
            >
              {THEMES.map((theme) => (
                <option key={theme.value} value={theme.value}>
                  {theme.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </FormSection>

      <FormSection title="Book parts" description="What to generate alongside the chapters.">
        <div className="space-y-4">
          <Switch
            label="Build a table of contents"
            description="Creates the EPUB navigation document. Reading systems use it for chapter jumping, and retailers expect it."
            checked={project.settings.includeTableOfContents}
            onChange={(event) => save({ includeTableOfContents: event.target.checked })}
          />

          <Switch
            label="Generate a cover page"
            description="Adds a title page as the first section of the book."
            checked={project.settings.generateCoverPage}
            onChange={(event) => save({ generateCoverPage: event.target.checked })}
          />
        </div>
      </FormSection>
    </div>
  )
}
