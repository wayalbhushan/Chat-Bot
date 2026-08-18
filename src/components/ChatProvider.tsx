import { useReducer, type ReactNode } from 'react'
import {
  ChatDispatchContext,
  ChatStateContext,
  chatReducer,
  initialChatState,
} from '../hooks/useChat'

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)

  return (
    <ChatStateContext.Provider value={state}>
      <ChatDispatchContext.Provider value={dispatch}>{children}</ChatDispatchContext.Provider>
    </ChatStateContext.Provider>
  )
}
