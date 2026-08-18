interface LiveAnnouncerProps {
  announcement: string
}

// The virtualized list cannot carry aria-live: Virtuoso mounts and unmounts rows
// while scrolling, and a screen reader would read long-dead messages as if they
// had just arrived. This holds only the latest change, so scrolling is silent.
export function LiveAnnouncer({ announcement }: LiveAnnouncerProps) {
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  )
}
