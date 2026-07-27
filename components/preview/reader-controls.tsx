'use client'

import * as React from 'react'

import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { PREVIEW_DEVICES, type PreviewDevice, type ReaderPreferences } from '@/lib/preview'

/**
 * Reader settings, as a reading system would offer them.
 *
 * WHY THESE FIVE
 * --------------
 * They are the ones a reader can change and an author cannot. Font size, line
 * spacing, measure, theme and justification are the controls every device
 * exposes, so they are exactly the conditions a book has to survive. Anything
 * an author *can* control belongs in the project settings, not here.
 *
 * The sliders are native range inputs. They are keyboard-operable, announce
 * their value, and respect the platform's own accessibility settings — three
 * things a custom slider has to re-earn and usually does not.
 */

export interface ReaderControlsProps {
  preferences: ReaderPreferences
  device: PreviewDevice
  onPreferencesChange: (changes: Partial<ReaderPreferences>) => void
  onDeviceChange: (id: string) => void
}

export function ReaderControls({
  preferences,
  device,
  onPreferencesChange,
  onDeviceChange,
}: ReaderControlsProps) {
  const fontId = React.useId()
  const lineId = React.useId()
  const measureId = React.useId()
  const deviceId = React.useId()
  const themeId = React.useId()
  const justifyId = React.useId()

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={deviceId}>Screen</Label>
        <Select
          id={deviceId}
          value={device.id}
          onChange={(event) => onDeviceChange(event.target.value)}
        >
          {PREVIEW_DEVICES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} · {option.width}px
            </option>
          ))}
        </Select>
        <p className="text-xs text-subtle-foreground">{device.note}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={themeId}>Reading theme</Label>
        <Select
          id={themeId}
          value={preferences.theme}
          onChange={(event) =>
            onPreferencesChange({ theme: event.target.value as ReaderPreferences['theme'] })
          }
        >
          <option value="light">Light</option>
          <option value="sepia">Sepia</option>
          <option value="dark">Dark</option>
        </Select>
        <p className="text-xs text-subtle-foreground">
          Dark mode is where a book that sets its own text colour becomes unreadable.
        </p>
      </div>

      <Range
        id={fontId}
        label="Text size"
        value={preferences.fontScale}
        min={0.8}
        max={1.8}
        step={0.1}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={(fontScale) => onPreferencesChange({ fontScale })}
      />

      <Range
        id={lineId}
        label="Line spacing"
        value={preferences.lineHeight}
        min={1.2}
        max={2.2}
        step={0.1}
        format={(value) => value.toFixed(1)}
        onChange={(lineHeight) => onPreferencesChange({ lineHeight })}
      />

      <Range
        id={measureId}
        label="Line length"
        value={preferences.measure}
        min={40}
        max={100}
        step={2}
        format={(value) => `${value} characters`}
        onChange={(measure) => onPreferencesChange({ measure })}
      />

      <Switch
        id={justifyId}
        label="Justify text"
        description="Many readers turn this on. It is where a narrow screen shows rivers of white space."
        checked={preferences.justify}
        onChange={(event) => onPreferencesChange({ justify: event.target.checked })}
      />
    </div>
  )
}

function Range({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary focus-ring"
      />
    </div>
  )
}
