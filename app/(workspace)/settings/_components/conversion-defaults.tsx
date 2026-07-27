'use client'

import { FormField } from '@/components/forms/form-field'
import { FormSection } from '@/components/forms/form-section'
import { Input } from '@/components/ui/input'

/**
 * Default book metadata applied to new projects.
 *
 * WHY THIS IS A CLIENT COMPONENT
 * ------------------------------
 * `FormField` passes its generated id and ARIA wiring to the control through a
 * render prop, and functions cannot cross the server/client boundary. So a form
 * built from these primitives lives in a Client Component.
 *
 * That is the right boundary anyway: forms are interactive by definition. The
 * rule this establishes for later phases is "pages stay server components,
 * forms are client islands" — which keeps the data-fetching and metadata work
 * on the server while only the interactive parts ship JavaScript.
 *
 * Fields are disabled until Phase 2 provides somewhere to persist them. The
 * accessible structure — labels, hints, described-by relationships — is already
 * complete, so Phase 2 supplies state and nothing else.
 */
export function ConversionDefaults() {
  return (
    <FormSection
      title="Book defaults"
      description="Pre-filled on every new project so you type them once."
      columns={2}
    >
      <FormField label="Default author" hint="Used as the primary creator in generated metadata.">
        {(field) => <Input {...field} placeholder="Your name" disabled />}
      </FormField>

      <FormField label="Default publisher" hint="Leave blank if you self-publish.">
        {(field) => <Input {...field} placeholder="Imprint name" disabled />}
      </FormField>

      <FormField
        label="Default language"
        hint="A BCP 47 tag such as en-GB. Required by EPUB and used by screen readers."
      >
        {(field) => <Input {...field} defaultValue="en-GB" disabled />}
      </FormField>

      <FormField
        label="Chapter heading level"
        hint="Which Word heading style begins a new chapter."
      >
        {(field) => <Input {...field} defaultValue="Heading 1" disabled />}
      </FormField>
    </FormSection>
  )
}
