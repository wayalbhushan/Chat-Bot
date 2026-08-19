// This module is the seam where a real backend would be substituted. Everything
// above it deals only in promises that resolve or reject, so swapping these two
// functions for fetch calls requires no change to the reducer or the components.

// Low enough that a demo is not interrupted every few sends, high enough that
// the failed state and its retry are still reachable by hand.
export const FAILURE_RATE = 0.05

export const SEND_LATENCY_MIN_MS = 400
export const SEND_LATENCY_MAX_MS = 900
export const REPLY_LATENCY_MIN_MS = 800
export const REPLY_LATENCY_MAX_MS = 1500

// Deliberately canned. Generating plausible replies would misrepresent what this
// take-home actually does.
const BOT_REPLIES = [
  'Thanks, noted.',
  'Understood.',
  'That makes sense.',
  'Got it, anything else?',
  'I see what you mean.',
]

function randomLatency(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sendMessage(text: string): Promise<string> {
  await delay(randomLatency(SEND_LATENCY_MIN_MS, SEND_LATENCY_MAX_MS))
  if (Math.random() < FAILURE_RATE) throw new Error('Delivery failed')
  return text
}

// The parameter is unused only because the replies are canned; a real endpoint
// would send it, so the signature keeps it rather than pretending otherwise.
export async function getBotReply(_userText: string): Promise<string> {
  await delay(randomLatency(REPLY_LATENCY_MIN_MS, REPLY_LATENCY_MAX_MS))
  return BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)] ?? BOT_REPLIES[0]
}
