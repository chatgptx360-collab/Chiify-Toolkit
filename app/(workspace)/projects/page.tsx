import type { Metadata } from 'next'
import { Suspense } from 'react'

import { SkeletonCard, SkeletonGroup, SkeletonText } from '@/components/ui/skeleton'

import { ProjectsWorkspace } from './_components/projects-workspace'

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Every manuscript you are preparing for publication.',
}

/**
 * Projects.
 *
 * A Server Component holding the route's metadata, with the workspace below it
 * as a client island — the same shape as every other screen. The page itself
 * ships no JavaScript beyond that island, and keeps its `metadata` export,
 * which it would lose if the whole route were marked `'use client'` just to
 * read the store.
 *
 * The `Suspense` boundary is required rather than decorative: the workspace
 * reads the query string, and a component that does so has to be suspendable
 * for the page to be prerendered at build time. The fallback is a skeleton at
 * the same metrics as the real content, so the screen does not reflow when it
 * resolves.
 */
export default function ProjectsPage() {
  return (
    <Suspense fallback={<ProjectsFallback />}>
      <ProjectsWorkspace />
    </Suspense>
  )
}

function ProjectsFallback() {
  return (
    <SkeletonGroup label="Loading your projects" className="space-y-8">
      <SkeletonText lines={2} className="max-w-md" />
      <SkeletonCard />
    </SkeletonGroup>
  )
}
