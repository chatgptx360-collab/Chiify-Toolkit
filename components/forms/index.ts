/**
 * Form building blocks.
 *
 * These handle *structure and accessibility*, not validation. Phase 2 chooses a
 * validation approach and layers it above these components; keeping the two
 * apart means the accessible wiring survives whatever that choice turns out
 * to be.
 */
export { FormField, type FormFieldProps, type FormFieldRenderProps } from './form-field'
export { FormSection, type FormSectionProps } from './form-section'
