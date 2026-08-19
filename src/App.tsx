import { useCallback, useMemo, useRef } from 'react'
import { ChatHeader } from './components/ChatHeader'
import { Composer } from './components/Composer'
import { LiveAnnouncer } from './components/LiveAnnouncer'
import { MessageList } from './components/MessageList'
import { useChatActions, useChatDispatch, useChatState } from './hooks/useChat'
import { usePersistence } from './hooks/usePersistence'
import { generateMessages } from './lib/seed'
import { clear } from './lib/storage'

const STRESS_COUNT = 10000

export function App() {
  const { messages, isBotTyping } = useChatState()
  const dispatch = useChatDispatch()
  const { send, retry } = useChatActions()
  const { suspendPersistence } = usePersistence()
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const announcement = useMemo(() => {
    if (isBotTyping) return 'Assistant is typing'
    const latest = messages[messages.length - 1]
    if (latest === undefined) return ''
    if (latest.status === 'failed') return 'Message failed to send'
    if (latest.status === 'sending') return ''
    return `${latest.role === 'bot' ? 'Assistant' : 'You'} said: ${latest.text}`
  }, [messages, isBotTyping])

  const handleAtBottomChange = useCallback(
    (isAtBottom: boolean) => {
      dispatch({ type: 'SET_AT_BOTTOM', isAtBottom })
    },
    [dispatch],
  )

  const handleRetry = useCallback(
    (id: string) => {
      retry(id)
      // The retry button unmounts as soon as the status changes, so focus would
      // fall back to the document body and lose the keyboard user's place.
      composerRef.current?.focus()
    },
    [retry],
  )

  const handleClear = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' })
    // Cleared immediately rather than waiting on the debounced write, so a
    // reload inside that window cannot resurrect the history.
    clear()
  }, [dispatch])

  const handleLoadStress = useCallback(() => {
    suspendPersistence()
    dispatch({ type: 'LOAD_HISTORY', messages: generateMessages(STRESS_COUNT) })
  }, [dispatch, suspendPersistence])

  return (
    // 100dvh rather than 100vh: mobile Safari's collapsing toolbar makes 100vh
    // taller than the visible area, which pushes the composer under the fold.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white text-slate-900">
      <a
        href="#message-input"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:border focus:border-slate-200 focus:bg-white focus:px-3 focus:py-2 focus:text-body focus:text-blue-600 focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
      >
        Skip to message input
      </a>
      <ChatHeader onClear={handleClear} onLoadStress={handleLoadStress} />
      <main className="min-h-0 flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isBotTyping={isBotTyping}
          onRetry={handleRetry}
          onAtBottomChange={handleAtBottomChange}
        />
      </main>
      <footer className="shrink-0 border-t border-slate-200">
        <div className="mx-auto w-full max-w-content px-4 py-3">
          <Composer onSend={send} inputRef={composerRef} />
        </div>
      </footer>
      <LiveAnnouncer announcement={announcement} />
    </div>
  )
}
