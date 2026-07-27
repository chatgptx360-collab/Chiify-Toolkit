'use client'

import { FormField } from '@/components/forms/form-field'
import { Select } from '@/components/ui/select'
import type { Project } from '@/lib/types'

/**
 * Choose which book a screen is about.
 *
 * The preview and the validation report both operate on one project, and both
 * are reachable from the sidebar without going through the converter first — so
 * both need to ask. Extracting it means the two screens cannot drift into
 * asking differently, and the default is the same everywhere: the most recently
 * updated project, which is almost always the one the author just left.
 */

export interface ProjectPickerProps {
  projects: readonly Project[]
  value: string
  onChange: (id: string) => void
  label?: string
  hint?: string
}

export function ProjectPicker({
  projects,
  value,
  onChange,
  label = 'Book',
  hint,
}: ProjectPickerProps) {
  return (
    <FormField label={label} {...(hint ? { hint } : {})}>
      {(field) => (
        <Select {...field} value={value} onChange={(event) => onChange(event.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  )
}
