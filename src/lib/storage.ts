import type { Message } from '../types'

// Versioned so a future shape change can be detected rather than silently
// mis-parsed against old data.
const STORAGE_KEY = 'darwix-chat-history-v1'
const QUOTA_TRIM_TO = 500

const ROLES = new Set(['user', 'bot'])
const STATUSES = new Set(['sending', 'sent', 'failed'])

function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.timestamp === 'number' &&
    typeof candidate.role === 'string' &&
    ROLES.has(candidate.role) &&
    typeof candidate.status === 'string' &&
    STATUSES.has(candidate.status)
  )
}

// A send in flight cannot survive a reload: the promise it awaits is gone, so a
// persisted 'sending' would sit there forever. Store it as failed instead, which
// is the one state the user can act on.
function settleInFlight(messages: Message[]): Message[] {
  return messages.map((message) =>
    message.status === 'sending' ? { ...message, status: 'failed' } : message,
  )
}

export function save(messages: Message[]): void {
  const payload = settleInFlight(messages)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Catches QuotaExceededError, and equally the SecurityError thrown when
    // storage is blocked outright. Retry once with only recent history.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.slice(-QUOTA_TRIM_TO)))
    } catch {
      // Storage is unusable; the session continues in memory rather than failing.
    }
  }
}

export function load(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return settleInFlight(parsed.filter(isMessage))
  } catch {
    return []
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to recover from; an unwritable store is already empty to us.
  }
}
