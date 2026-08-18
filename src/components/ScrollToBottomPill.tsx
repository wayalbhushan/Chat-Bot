import { ChevronDown } from 'lucide-react'

interface ScrollToBottomPillProps {
  unreadCount: number
  onScrollToBottom: () => void
}

export function ScrollToBottomPill({ unreadCount, onScrollToBottom }: ScrollToBottomPillProps) {
  const hasUnread = unreadCount > 0
  const label = hasUnread
    ? `${unreadCount} new ${unreadCount === 1 ? 'message' : 'messages'}`
    : 'Scroll to latest'

  return (
    <button
      type="button"
      onClick={onScrollToBottom}
      aria-label={label}
      // Bordered rather than raised: the composer holds the app's only shadow.
      className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-meta text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      {hasUnread && <span>{label}</span>}
    </button>
  )
}
