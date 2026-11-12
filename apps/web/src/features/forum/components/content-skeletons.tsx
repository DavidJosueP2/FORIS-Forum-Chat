import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export function ContentSkeleton({ label, children }: { label: string; children: ReactNode }) {
  return <div role="status">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">{children}</div>
  </div>
}

export function PostRowsPlaceholder({ compact = false }: { compact?: boolean }) {
  return <ol className={compact ? 'forum-post-list' : 'discovery-feed-list'}>
    {[0, 1].map(index => <li key={index} className={compact ? 'forum-post-row' : 'discovery-post'}>
      {compact ? (
        <div className="forum-meta">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <div className="discovery-post-meta min-h-11">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      )}
      <Skeleton className={index ? 'mb-3 mt-4 h-6 w-1/2' : 'mb-3 mt-4 h-7 w-3/4'} />
      <div className="grid max-w-[70ch] gap-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      {!compact && index === 0 && <Skeleton className="mt-4 aspect-video max-h-64 w-full rounded-xl" />}
      <div className="mt-3 flex min-h-11 items-center gap-3">
        <Skeleton className="h-6 w-20 rounded-full" />
        {!compact && <Skeleton className="h-3.5 w-20" />}
      </div>
    </li>)}
  </ol>
}

export function PublicationSkeleton() {
  return <ContentSkeleton label="Cargando publicación…">
    <div className="content-columns">
      <div className="content-primary">
        <div className="reading-post-meta min-h-11">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="my-3 h-4 w-24" />
        <Skeleton className="mb-5 h-8 w-4/5" />
        <div className="grid max-w-[70ch] gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="reading-post-actions min-h-11 gap-3">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <div className="reading-discussion">
          <Skeleton className="mb-3 h-5 w-28" />
          <CommentPlaceholders />
        </div>
      </div>
      <div className="context-rail">
        <div className="context-section">
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="context-identity">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
      </div>
    </div>
  </ContentSkeleton>
}

export function CommentPlaceholders({ count = 1 }: { count?: 1 | 2 }) {
  return <ol className="reading-comment-list">
    {Array.from({ length: count }, (_, index) => (
      <li key={index} className="reading-comment">
        <div className="reading-comment-meta">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="mt-2 grid max-w-[65ch] gap-2.5">
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      </li>
    ))}
  </ol>
}
