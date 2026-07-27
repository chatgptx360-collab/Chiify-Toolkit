import type { Metadata } from 'next'

import { ProjectDetail } from './_components/project-detail'

export const metadata: Metadata = {
  // The project name is only known on the client, so the static title names the
  // section instead. Phase "Cloud Sync" gives the server access to the record
  // and this becomes `generateMetadata`.
  title: 'Project',
}

/**
 * Project detail.
 *
 * `params` is a Promise in the App Router — Next resolves route parameters
 * asynchronously so a page can start rendering before they are available.
 */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return <ProjectDetail projectId={id} />
}
