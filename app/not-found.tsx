import { ArrowLeft, Compass } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/common/empty-state'
import { Logo } from '@/components/common/logo'
import { Button } from '@/components/ui/button'
import { defaultRoute } from '@/lib/config/navigation'

export const metadata: Metadata = {
  title: 'Page not found',
}

/**
 * 404.
 *
 * Rendered outside the workspace shell deliberately: a missing route may sit
 * outside the sidebar's world entirely, and showing navigation for a workspace
 * the user may not be in is misleading. It gets its own centred layout with a
 * single clear way back.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center px-6 py-5">
        <Link
          href={defaultRoute}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo />
        </Link>
      </div>

      <main className="flex flex-1 items-center justify-center px-6 pb-20">
        <EmptyState
          icon={Compass}
          size="lg"
          title="We can't find that page"
          description="The link may be out of date, or the page may belong to a part of the toolkit that has not shipped yet."
          action={
            <Button variant="primary" asChild>
              <Link href={defaultRoute}>
                <ArrowLeft aria-hidden="true" />
                Back to the dashboard
              </Link>
            </Button>
          }
          className="w-full max-w-xl"
        />
      </main>
    </div>
  )
}
