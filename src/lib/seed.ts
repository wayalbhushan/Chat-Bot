import type { Message, Role } from '../types'

const BURST_CHANCE = 0.35
const BURST_GAP_MS = 25_000
const REPLY_GAP_MS = 900_000
const LONG_MESSAGE_EVERY = 13

const SHORT_TEXTS = [
  'Got it, thanks.',
  'Can you expand on that?',
  'Makes sense.',
  'One more thing.',
  'Perfect.',
  'What about mobile?',
]

const MEDIUM_TEXTS = [
  'The list only renders what fits in the viewport, so the DOM stays small no matter how long the history gets.',
  'Scroll position is anchored to the bottom only while the user is already there, otherwise new messages would yank the viewport.',
  'Failed sends keep their place in the conversation so retrying never reorders anything.',
  'Timestamps are relative up to a day old, then fall back to a short date.',
]

const LONG_PARAGRAPH =
  'Virtualization keeps the DOM small by rendering only the rows inside the viewport plus a small overscan buffer, which is what lets the list stay smooth at ten thousand messages. '

const LONG_TEXT = LONG_PARAGRAPH.repeat(9)

/** Seeded so a given message count always produces the same conversation. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickText(index: number, role: Role, random: () => number): string {
  if (index % LONG_MESSAGE_EVERY === LONG_MESSAGE_EVERY - 1) return LONG_TEXT
  const pool = role === 'user' ? SHORT_TEXTS : MEDIUM_TEXTS
  return pool[Math.floor(random() * pool.length)]
}

export function generateMessages(count: number): Message[] {
  const random = mulberry32(count)
  const roles: Role[] = []
  const gaps: number[] = []

  for (let index = 0; index < count; index += 1) {
    const previousRole = roles[index - 1]
    const repeats = previousRole !== undefined && random() < BURST_CHANCE
    roles.push(repeats ? previousRole : previousRole === 'user' ? 'bot' : 'user')
    gaps.push(
      repeats
        ? Math.floor(random() * BURST_GAP_MS)
        : BURST_GAP_MS * 3 + Math.floor(random() * REPLY_GAP_MS),
    )
  }

  // Anchor the run so the newest message lands on now rather than in the future.
  let timestamp = Date.now() - gaps.reduce((total, gap) => total + gap, 0)

  return roles.map((role, index) => {
    timestamp += gaps[index]
    return {
      id: crypto.randomUUID(),
      role,
      text: pickText(index, role, random),
      timestamp,
      status: 'sent',
    }
  })
}
