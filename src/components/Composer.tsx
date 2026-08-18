import {
  useLayoutEffect,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { SendHorizontal } from 'lucide-react'

const MAX_HEIGHT_PX = 160
const MAX_LENGTH = 4000
const COUNTER_VISIBLE_FROM = 3500

interface ComposerProps {
  onSend: (text: string) => void
  // Owned by the parent so focus can be returned here after a retry, which
  // otherwise strands a keyboard user on a button that has just disappeared.
  inputRef: RefObject<HTMLTextAreaElement>
}

export function Composer({ onSend, inputRef }: ComposerProps) {
  const [value, setValue] = useState('')
  const textareaRef = inputRef

  // Measured after render rather than in the change handler, so clearing and
  // paste truncation shrink the box as well as growing it.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (textarea === null) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [value, textareaRef])

  const canSend = value.trim().length > 0

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value)
  }

  const handleSend = () => {
    const text = value.trim()
    if (text.length === 0) return
    onSend(text)
    setValue('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      setValue('')
      return
    }
    if (event.key !== 'Enter' || event.shiftKey) return
    // A coarse pointer means no Shift key within reach, so Enter has to be the
    // newline. isComposing guards IME candidate selection, which also fires Enter.
    if (window.matchMedia('(pointer: coarse)').matches) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    handleSend()
  }

  return (
    <div>
      {/* The app's single shadow. */}
      <div className="flex items-end gap-2 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
        <textarea
          ref={textareaRef}
          id="message-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder="Send a message"
          aria-label="Message input"
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-body text-slate-900 placeholder:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            canSend
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'cursor-not-allowed bg-slate-100 text-slate-400'
          }`}
        >
          <SendHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {value.length >= COUNTER_VISIBLE_FROM && (
        <p className="mt-1 text-right text-meta text-slate-600">
          {value.length}/{MAX_LENGTH}
        </p>
      )}
    </div>
  )
}
