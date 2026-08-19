import { useState } from 'react'
import { MessageSquare, Trash2 } from 'lucide-react'

interface ChatHeaderProps {
  onClear: () => void
  onLoadStress: () => void
}

// Padding carries the 44px touch target so the controls stay visually light
// while remaining comfortably tappable.
const QUIET_CONTROL =
  'flex h-11 items-center rounded-md text-meta font-normal text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

export function ChatHeader({ onClear, onLoadStress }: ChatHeaderProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  const handleConfirm = () => {
    setIsConfirming(false)
    onClear()
  }

  return (
    <header className="shrink-0 border-b border-slate-200">
      <div className="mx-auto flex h-14 w-full max-w-content items-center gap-2 px-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100">
          <MessageSquare className="h-4 w-4 text-blue-600" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-header font-semibold leading-5">Assistant</span>
          <span className="flex items-center gap-1 text-meta leading-4 text-slate-600">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
            Online
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {/* Shipped in production on purpose: the 10,000-message case is the
              point of the build, and a reviewer cannot reach it by typing. */}
          <button
            type="button"
            onClick={onLoadStress}
            aria-label="Load 10,000 demo messages"
            className={`${QUIET_CONTROL} px-2 whitespace-nowrap`}
          >
            10k demo
          </button>
          {/* Two-step inline rather than window.confirm: a native dialog steals
              focus to the browser chrome and cannot be styled or keyboard-tested. */}
          {isConfirming ? (
            <>
              <span className="text-meta text-slate-600">Clear all?</span>
              <button
                type="button"
                onClick={handleConfirm}
                className={`${QUIET_CONTROL} px-2 font-medium text-red-600 hover:text-red-700`}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className={`${QUIET_CONTROL} px-2`}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirming(true)}
              aria-label="Clear chat history"
              className={`${QUIET_CONTROL} w-11 justify-center`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
