import { Bot } from 'lucide-react'

const DOT_DELAYS = ['0ms', '150ms', '300ms']

export function TypingIndicator() {
  return (
    <div className="mt-3 flex justify-start gap-2">
      <div className="h-6 w-6 shrink-0">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200">
          <Bot className="h-4 w-4 text-slate-500" aria-hidden="true" />
        </span>
      </div>
      {/* Matches a real bubble's padding and line height so the list does not
          shift when this is swapped for the reply. */}
      <div className="flex items-center gap-1 rounded-md bg-slate-100 px-3 py-2">
        {DOT_DELAYS.map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce"
            style={{ animationDelay: delay }}
          />
        ))}
      </div>
    </div>
  )
}
