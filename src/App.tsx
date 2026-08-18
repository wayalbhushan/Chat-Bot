import { useCallback } from 'react'
import { ChatHeader } from './components/ChatHeader'
import { Composer } from './components/Composer'
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

  const handleAtBottomChange = useCallback(
    (isAtBottom: boolean) => {
      dispatch({ type: 'SET_AT_BOTTOM', isAtBottom })
    },
    [dispatch],
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
      <ChatHeader onClear={handleClear} onLoadStress={handleLoadStress} />
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
