import { createContext, useCallback, useContext, useRef, type Dispatch } from 'react'
import type { ChatState, Message } from '../types'
import { getBotReply, sendMessage } from '../lib/mockApi'

export type ChatAction =
  | { type: 'SEND_MESSAGE'; id: string; text: string; timestamp: number }
  | { type: 'MESSAGE_SENT'; id: string }
  | { type: 'MESSAGE_FAILED'; id: string }
  | { type: 'RETRY_MESSAGE'; id: string }
  | { type: 'BOT_TYPING_START' }
  | { type: 'BOT_REPLY'; id: string; text: string; timestamp: number }
  | { type: 'LOAD_HISTORY'; messages: Message[] }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_AT_BOTTOM'; isAtBottom: boolean }

export const initialChatState: ChatState = {
  messages: [],
  isBotTyping: false,
  isAtBottom: true,
}

function withStatus(
  messages: Message[],
  id: string,
  status: Message['status'],
): Message[] {
  return messages.map((message) => (message.id === id ? { ...message, status } : message))
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SEND_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: action.id,
            role: 'user',
            text: action.text,
            timestamp: action.timestamp,
            status: 'sending',
          },
        ],
      }
    case 'MESSAGE_SENT':
      return { ...state, messages: withStatus(state.messages, action.id, 'sent') }
    case 'MESSAGE_FAILED':
      return { ...state, messages: withStatus(state.messages, action.id, 'failed') }
    // Retry mutates in place rather than re-appending, so a recovered message
    // keeps its original position in the conversation.
    case 'RETRY_MESSAGE':
      return { ...state, messages: withStatus(state.messages, action.id, 'sending') }
    case 'BOT_TYPING_START':
      return { ...state, isBotTyping: true }
    case 'BOT_REPLY':
      return {
        ...state,
        isBotTyping: false,
        messages: [
          ...state.messages,
          {
            id: action.id,
            role: 'bot',
            text: action.text,
            timestamp: action.timestamp,
            status: 'sent',
          },
        ],
      }
    case 'LOAD_HISTORY':
      return { ...state, messages: action.messages }
    case 'CLEAR_HISTORY':
      return { ...state, messages: [], isBotTyping: false }
    case 'SET_AT_BOTTOM':
      return { ...state, isAtBottom: action.isAtBottom }
  }
}

export const ChatStateContext = createContext<ChatState | null>(null)
export const ChatDispatchContext = createContext<Dispatch<ChatAction> | null>(null)

export function useChatState(): ChatState {
  const state = useContext(ChatStateContext)
  if (state === null) throw new Error('useChatState must be used inside ChatProvider')
  return state
}

// Split from state so the composer, which only dispatches, does not re-render
// on every incoming message.
export function useChatDispatch(): Dispatch<ChatAction> {
  const dispatch = useContext(ChatDispatchContext)
  if (dispatch === null) throw new Error('useChatDispatch must be used inside ChatProvider')
  return dispatch
}

export function useChatActions() {
  const dispatch = useChatDispatch()
  const { messages } = useChatState()
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  // Replies run through one chain so a send that lands mid-reply waits its turn
  // instead of racing: two overlapping replies would clear isBotTyping early and
  // append out of order.
  const replyChainRef = useRef<Promise<void>>(Promise.resolve())

  const queueBotReply = useCallback(
    (text: string) => {
      replyChainRef.current = replyChainRef.current.then(async () => {
        dispatch({ type: 'BOT_TYPING_START' })
        const reply = await getBotReply(text)
        dispatch({
          type: 'BOT_REPLY',
          id: crypto.randomUUID(),
          text: reply,
          timestamp: Date.now(),
        })
      })
    },
    [dispatch],
  )

  const deliver = useCallback(
    async (id: string, text: string) => {
      try {
        await sendMessage(text)
      } catch {
        dispatch({ type: 'MESSAGE_FAILED', id })
        return
      }
      dispatch({ type: 'MESSAGE_SENT', id })
      queueBotReply(text)
    },
    [dispatch, queueBotReply],
  )

  const send = useCallback(
    (text: string) => {
      const id = crypto.randomUUID()
      dispatch({ type: 'SEND_MESSAGE', id, text, timestamp: Date.now() })
      void deliver(id, text)
    },
    [dispatch, deliver],
  )

  // Retry reuses the original id, so the message keeps its place in the list.
  const retry = useCallback(
    (id: string) => {
      const message = messagesRef.current.find((candidate) => candidate.id === id)
      if (message === undefined) return
      dispatch({ type: 'RETRY_MESSAGE', id })
      void deliver(id, message.text)
    },
    [dispatch, deliver],
  )

  return { send, retry }
}
