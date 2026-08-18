import { useCallback, useEffect, useRef } from 'react'
import { useChatDispatch, useChatState } from './useChat'
import { hasStoredHistory, load, save } from '../lib/storage'
import { generateMessages } from '../lib/seed'

const WRITE_DEBOUNCE_MS = 500
const DEMO_SEED_COUNT = 15

export function usePersistence() {
  const { messages } = useChatState()
  const dispatch = useChatDispatch()
  const hasLoadedRef = useRef(false)
  const isSuspendedRef = useRef(false)

  useEffect(() => {
    // A first visit is seeded with a short conversation so the app does not open
    // on an empty screen. Clearing the history writes an empty array, which
    // counts as stored, so the empty state stays reachable and stays put.
    const messages = hasStoredHistory() ? load() : generateMessages(DEMO_SEED_COUNT)
    dispatch({ type: 'LOAD_HISTORY', messages })
    hasLoadedRef.current = true
  }, [dispatch])

  // Debounced because localStorage writes are synchronous: serialising the whole
  // history on every keystroke-driven state change would block the main thread
  // and undo the work virtualization does.
  useEffect(() => {
    if (!hasLoadedRef.current || isSuspendedRef.current) return
    const timer = setTimeout(() => save(messages), WRITE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [messages])

  // The stress dataset is disposable and would evict real history, so once it is
  // loaded this session stops writing entirely.
  const suspendPersistence = useCallback(() => {
    isSuspendedRef.current = true
  }, [])

  return { suspendPersistence }
}
