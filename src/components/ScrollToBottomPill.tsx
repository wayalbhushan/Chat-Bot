import { ChevronDown } from 'lucide-react'

interface ScrollToBottomPillProps {
  unreadCount: number
  onScrollToBottom: () => void
}

export function ScrollToBottomPill({ unreadCount, onScrollToBottom }: ScrollToBottomPillProps) {
  const hasUnread = unreadCount > 0
  const label = hasUnread
    ? `${unreadCount} new ${unreadCount === 1 ? 'message' : 'messages'}`
    : 'Jump to latest'

  return (
    <button
      type="button"
      onClick={onScrollToBottom}
      aria-label={hasUnread ? `${label}, jump to latest` : label}
      // Bordered rather than raised: the composer holds the app's only shadow.
      className="absolute bottom-4 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-meta font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
