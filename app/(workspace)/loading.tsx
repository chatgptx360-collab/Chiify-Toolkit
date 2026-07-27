import { Skeleton, SkeletonCard, SkeletonGroup } from '@/components/ui/skeleton'

/**
 * Workspace loading state.
 *
 * Placed on the route group rather than on each page so every workspace route
 * gets a streaming fallback for free. The shape mirrors the real pages — a page
 * header followed by a card grid — so the transition is a fill-in rather than a
 * relayout, which is what makes a skeleton feel fast instead of busy.
 */
export default function WorkspaceLoading() {
  return (
    <SkeletonGroup label="Loading page" className="space-y-10">
      <div className="space-y-3">
        <Skeleton shape="line" className="h-7 w-52" />
        <Skeleton shape="line" className="h-3 w-full max-w-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </SkeletonGroup>
  )
}
