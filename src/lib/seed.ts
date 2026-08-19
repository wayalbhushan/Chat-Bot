import type { Message, Role } from '../types'

const BURST_CHANCE = 0.35
const BURST_GAP_MS = 25_000
const REPLY_GAP_MS = 900_000
const LONG_MESSAGE_EVERY = 13
const TERSE_CHANCE = 0.22

const USER_TERSE = ['Thanks.', 'Perfect.', 'Got it.', 'Right.', 'Sure.', 'Makes sense.']

const USER_LINES = [
  'Can you expand on that?',
  'What happens on mobile?',
  'How does that hold up with ten thousand messages?',
  'One more thing before I forget.',
  'Does that survive a reload?',
  'What if the send fails halfway through?',
  'Is that measured or estimated?',
]

const BOT_TERSE = ['Understood.', 'Noted.', 'Exactly.', 'Correct.', 'Of course.']

const BOT_LINES = [
  'Only the rows inside the viewport are rendered, so the DOM stays small however long the history gets.',
  'Scroll position is anchored to the bottom only while you are already there, otherwise new messages would yank the viewport.',
  'Failed sends keep their place in the conversation, so retrying never reorders anything.',
  'Timestamps stay relative for the first day, then fall back to a short date.',
  'History is written to localStorage on a debounce rather than on every keystroke.',
  'A send interrupted by a reload comes back as failed, which is the one state you can act on.',
  'The typing indicator lives inside the list, so nothing shifts when it appears.',
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

// Walking forward on a collision keeps the sequence deterministic while keeping
// a sender's recent lines apart: avoiding only the immediately previous text
// still let one phrase open two runs a screen apart.
const RECENT_MEMORY = 2

function pickFrom(pool: string[], random: () => number, recent: string[]): string {
  const start = Math.floor(random() * pool.length)
  for (let step = 0; step < pool.length; step += 1) {
    const candidate = pool[(start + step) % pool.length]
    if (!recent.includes(candidate)) return candidate
  }
  return pool[start]
}

function pickText(index: number, role: Role, random: () => number, recent: string[]): string {
  if (index % LONG_MESSAGE_EVERY === LONG_MESSAGE_EVERY - 1) return LONG_TEXT
  const terse = role === 'user' ? USER_TERSE : BOT_TERSE
  const lines = role === 'user' ? USER_LINES : BOT_LINES
  return pickFrom(random() < TERSE_CHANCE ? terse : lines, random, recent)
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
  const recentByRole = new Map<Role, string[]>()

  return roles.map((role, index) => {
    timestamp += gaps[index]
    const recent = recentByRole.get(role) ?? []
    const text = pickText(index, role, random, recent)
    recentByRole.set(role, [text, ...recent].slice(0, RECENT_MEMORY))
    return {
      id: crypto.randomUUID(),
      role,
      text,
      timestamp,
      status: 'sent',
    }
  })
}
