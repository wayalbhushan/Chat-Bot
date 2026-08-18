import { useCallback, useEffect } from 'react'
import { ChatHeader } from './components/ChatHeader'
import { Composer } from './components/Composer'
import { MessageList } from './components/MessageList'
import { useChatActions, useChatDispatch, useChatState } from './hooks/useChat'
import { generateMessages } from './lib/seed'

const SEED_COUNT = 30

export function App() {
  const { messages, isBotTyping } = useChatState()
  const dispatch = useChatDispatch()

  // Temporary until persistence lands; LOAD_HISTORY replaces the array, so the
  // StrictMode double-mount cannot duplicate the seed.
  useEffect(() => {
    dispatch({ type: 'LOAD_HISTORY', messages: generateMessages(SEED_COUNT) })
  }, [dispatch])

  const { send, retry } = useChatActions()

  const handleAtBottomChange = useCallback(
    (isAtBottom: boolean) => {
      dispatch({ type: 'SET_AT_BOTTOM', isAtBottom })
    },
    [dispatch],
  )

  return (
    // 100dvh rather than 100vh: mobile Safari's collapsing toolbar makes 100vh
    // taller than the visible area, which pushes the composer under the fold.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white text-slate-900">
      <ChatHeader />
      <main className="min-h-0 flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isBotTyping={isBotTyping}
          onRetry={retry}
          onAtBottomChange={handleAtBottomChange}
        />
      </main>
      <footer className="shrink-0 border-t border-slate-200">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <Composer onSend={send} />
        </div>
      </footer>
    </div>
  )
}
