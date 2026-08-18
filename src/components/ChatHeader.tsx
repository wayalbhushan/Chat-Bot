import { useState } from 'react'
import { MessageSquare, Trash2 } from 'lucide-react'

interface ChatHeaderProps {
  onClear: () => void
  onLoadStress: () => void
}

export function ChatHeader({ onClear, onLoadStress }: ChatHeaderProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  const handleConfirm = () => {
    setIsConfirming(false)
    onClear()
  }

  return (
    <header className="shrink-0 border-b border-slate-200">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100">
          <MessageSquare className="h-4 w-4 text-blue-600" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-header font-semibold leading-5">Assistant</span>
          <span className="text-meta leading-4 text-slate-500">Online</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={onLoadStress}
              className="rounded-md border border-slate-200 px-2 py-1 text-meta text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Load 10k
            </button>
          )}
          {/* Two-step inline rather than window.confirm: a native dialog steals
              focus to the browser chrome and cannot be styled or keyboard-tested. */}
          {isConfirming ? (
            <>
              <span className="text-meta text-slate-500">Clear all?</span>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-md px-1 text-meta font-medium text-red-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="rounded-md px-1 text-meta text-slate-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirming(true)}
              aria-label="Clear chat history"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
