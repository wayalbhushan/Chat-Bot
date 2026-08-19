import { AlertCircle, Bot } from 'lucide-react'
import type { Message } from '../types'
import { formatFull, formatRelative, toISO } from '../lib/time'

interface MessageBubbleProps {
  message: Message
  isGrouped: boolean
  // True only for the final message of a same-sender run, so a run reads as one
  // block with a single time rather than a stack of repeated stamps.
  showTimestamp: boolean
  onRetry: (id: string) => void
}

export function MessageBubble({
  message,
  isGrouped,
  showTimestamp,
  onRetry,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isFailed = message.status === 'failed'

  const bubbleClasses = [
    // wrap-anywhere, not break-words: only `overflow-wrap: anywhere` shrinks the
    // bubble's min-content width, so an unbroken 500-character string wraps
    // instead of forcing the row wider than the viewport.
    'min-w-0 rounded-md px-3 py-2 text-body whitespace-pre-wrap wrap-anywhere',
    isUser ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900',
    message.status === 'sending' ? 'opacity-60' : '',
    isFailed ? 'border border-red-500' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      aria-label={`${isUser ? 'You' : 'Assistant'} at ${formatFull(message.timestamp)}`}
      className={`flex gap-2 ${isGrouped ? 'mt-0.5' : 'mt-4'} ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* The column is reserved even when the icon is hidden, so grouped bot
          bubbles stay aligned with the first one in the run. */}
      {!isUser && (
        <div className="h-6 w-6 shrink-0">
          {!isGrouped && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200">
              <Bot className="h-4 w-4 text-slate-600" aria-hidden="true" />
            </span>
          )}
        </div>
      )}
      <div
        className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[68%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <div className={bubbleClasses}>{message.text}</div>
        {/* Kept in the markup even when hidden: the machine-readable time and
            the hover detail belong to every message, only the visible stamp is
            reserved for the end of a run. */}
        <time
          className={showTimestamp ? 'mt-1 text-meta text-slate-600' : 'sr-only'}
          dateTime={toISO(message.timestamp)}
          title={formatFull(message.timestamp)}
        >
          {formatRelative(message.timestamp)}
        </time>
        {isFailed && (
          <div className="mt-1 flex items-center gap-1 text-meta text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Not delivered</span>
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="rounded-md px-1 font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
