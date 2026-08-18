import { useEffect } from 'react'
import { ChatHeader } from './components/ChatHeader'
import { EmptyState } from './components/EmptyState'
import { MessageBubble } from './components/MessageBubble'
import { useChatDispatch, useChatState } from './hooks/useChat'
import { generateMessages } from './lib/seed'
import { GROUP_WINDOW_MS } from './lib/time'

const SEED_COUNT = 30

export function App() {
  const { messages } = useChatState()
  const dispatch = useChatDispatch()

  // Temporary until persistence lands; LOAD_HISTORY replaces the array, so the
  // StrictMode double-mount cannot duplicate the seed.
  useEffect(() => {
    dispatch({ type: 'LOAD_HISTORY', messages: generateMessages(SEED_COUNT) })
  }, [dispatch])

  const handleRetry = (id: string) => {
    dispatch({ type: 'RETRY_MESSAGE', id })
  }

  return (
    // 100dvh rather than 100vh: mobile Safari's collapsing toolbar makes 100vh
    // taller than the visible area, which pushes the composer under the fold.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white text-slate-900">
      <ChatHeader />
      <main className="min-h-0 flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 py-3">
              {messages.map((message, index) => {
                const previous = messages[index - 1]
                const isGrouped =
                  previous !== undefined &&
                  previous.role === message.role &&
                  message.timestamp - previous.timestamp < GROUP_WINDOW_MS

                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isGrouped={isGrouped}
                    onRetry={handleRetry}
                  />
                )
              })}
            </div>
          </div>
        )}
      </main>
      <footer className="shrink-0 border-t border-slate-200">
        <div className="mx-auto w-full max-w-3xl px-4 py-3" />
      </footer>
    </div>
  )
}
