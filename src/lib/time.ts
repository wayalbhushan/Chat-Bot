const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** Consecutive messages from one sender collapse when they land inside this window. */
export const GROUP_WINDOW_MS = MINUTE_MS

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const fullDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const fullTime = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

export function formatRelative(ts: number): string {
  const elapsed = Date.now() - ts
  if (elapsed < MINUTE_MS) return 'just now'
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m ago`
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h ago`
  return dayMonth.format(ts)
}

export function formatFull(ts: number): string {
  return `${fullDate.format(ts)}, ${fullTime.format(ts)}`
}

export function toISO(ts: number): string {
  return new Date(ts).toISOString()
}
