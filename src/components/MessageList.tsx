import { useCallback, useEffect, useRef, useState } from 'react'
import { Virtuoso, type Components, type VirtuosoHandle } from 'react-virtuoso'
import type { Message } from '../types'
import { EmptyState } from './EmptyState'
import { MessageBubble } from './MessageBubble'
import { ScrollToBottomPill } from './ScrollToBottomPill'
import { TypingIndicator } from './TypingIndicator'
import { GROUP_WINDOW_MS } from '../lib/time'

const AT_BOTTOM_THRESHOLD_PX = 80
// Following resumes only at the true bottom, not anywhere inside the at-bottom
// threshold. Those are different questions: 80px is generous enough to decide
// whether to show the pill, but using it to decide whether to keep pinning made
// every scroll of less than 80px snap straight back, so the list could not be
// nudged up at all.
const FOLLOW_RESUME_PX = 4
const UPWARD_KEYS = new Set(['ArrowUp', 'PageUp', 'Home'])
const VIEWPORT_OVERSCAN_PX = 400
const SMOOTH_JUMP_MAX_PX = 2000
const SMOOTH_SETTLE_MS = 400
const SETTLE_PASSES = 6

interface ListContext {
  isBotTyping: boolean
}

interface MessageListProps {
  messages: Message[]
  isBotTyping: boolean
  onRetry: (id: string) => void
  onAtBottomChange: (isAtBottom: boolean) => void
}

// Typing belongs to the list's own footer rather than an absolutely positioned
// overlay, so Virtuoso counts its height and the last message does not jump
// when it appears or disappears.
const ListFooter: Components<Message, ListContext>['Footer'] = ({ context }) => (
  <div className="mx-auto w-full max-w-content px-4 pb-3">
    {context?.isBotTyping ? <TypingIndicator /> : null}
  </div>
)

export function MessageList({
  messages,
  isBotTyping,
  onRetry,
  onAtBottomChange,
}: MessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [scroller, setScroller] = useState<HTMLElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const previousCountRef = useRef(messages.length)
  const followRef = useRef(true)
  const isParkedRef = useRef(false)

  // Frozen at the first non-empty render. Virtuoso reads this only when it
  // mounts, and history arrives one tick after mount, so it cannot be derived
  // from the current length: recomputing it on every message made Virtuoso
  // fight its own scroll position.
  const initialIndexRef = useRef<number | null>(null)
  if (initialIndexRef.current === null && messages.length > 0) {
    initialIndexRef.current = messages.length - 1
  }

  // Position alone cannot answer this. The gap grows both when the user scrolls
  // away and when the list grows beneath them, and scrollTop is no better a
  // signal because Virtuoso nudges it itself while correcting estimated row
  // heights. So an upward gesture is what parks the list: until the user comes
  // back to the true bottom, nothing re-pins, which is what makes a scroll of a
  // few pixels possible at all. Without a gesture the gap rule still applies,
  // so appended content keeps following.
  useEffect(() => {
    if (scroller === null) return

    const gapNow = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight

    const park = () => {
      if (gapNow() > FOLLOW_RESUME_PX) {
        isParkedRef.current = true
        followRef.current = false
      }
    }

    const handleScroll = () => {
      const gap = gapNow()
      if (gap <= FOLLOW_RESUME_PX) {
        isParkedRef.current = false
        followRef.current = true
        return
      }
      followRef.current = isParkedRef.current ? false : gap <= AT_BOTTOM_THRESHOLD_PX
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) park()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (UPWARD_KEYS.has(event.key)) park()
    }

    scroller.addEventListener('scroll', handleScroll, { passive: true })
    scroller.addEventListener('wheel', handleWheel, { passive: true })
    scroller.addEventListener('touchmove', park, { passive: true })
    scroller.addEventListener('keydown', handleKeyDown)
    return () => {
      scroller.removeEventListener('scroll', handleScroll)
      scroller.removeEventListener('wheel', handleWheel)
      scroller.removeEventListener('touchmove', park)
      scroller.removeEventListener('keydown', handleKeyDown)
    }
  }, [scroller])

  // Observing the rendered list rather than Virtuoso's own callbacks: its
  // follow scrolls before the appended row has been measured, so it targets the
  // previous bottom and never corrects. A resize observation fires after layout,
  // when the height is real.
  useEffect(() => {
    if (scroller === null) return
    const list = scroller.querySelector('[data-testid="virtuoso-item-list"]')
    if (list === null) return
    const observer = new ResizeObserver(() => {
      if (!followRef.current) return
      scroller.scrollTop = scroller.scrollHeight
    })
    observer.observe(list)
    // The typing footer sits outside the item list, so its height changes are
    // invisible to an observer watching only the list. During a burst it toggles
    // on every reply, and those uncounted pixels accumulated into a 1300px gap.
    const footer = list.parentElement?.lastElementChild
    if (footer instanceof HTMLElement && footer !== list) observer.observe(footer)
    // The scroller itself, because the composer grows outside it: an auto-growing
    // textarea takes height from this element without changing any content
    // inside it, pushing the newest message out of view mid-sentence.
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [scroller])

  useEffect(() => {
    const delta = messages.length - previousCountRef.current
    previousCountRef.current = messages.length
    if (delta > 0 && !isAtBottom) {
      setUnreadCount((count) => count + delta)
    }
  }, [messages.length, isAtBottom])

  const handleAtBottomStateChange = useCallback(
    (atBottom: boolean) => {
      setIsAtBottom(atBottom)
      if (atBottom) setUnreadCount(0)
      onAtBottomChange(atBottom)
    },
    [onAtBottomChange],
  )

  const handleScrollToBottom = () => {
    if (scroller === null) {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'smooth' })
      return
    }

    const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight

    if (remaining <= SMOOTH_JUMP_MAX_PX) {
      // Animate the scroller to its own bottom rather than aligning the last
      // row: align:'end' stops at that row's edge and leaves the footer below
      // the fold, which parked the view 103px short and left the pill showing.
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
      window.setTimeout(() => {
        scroller.scrollTop = scroller.scrollHeight
      }, SMOOTH_SETTLE_MS)
      return
    }

    // Rows outside the viewport are only estimated, so one long jump lands short
    // and the heights measured on arrival push the bottom further away. A smooth
    // animation never converges across thousands of rows; each instant pass
    // corrects against what the previous pass measured.
    let pass = 0
    const settle = () => {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' })
      pass += 1
      if (pass < SETTLE_PASSES) {
        requestAnimationFrame(settle)
        return
      }
      // align:'end' stops at the last row's bottom edge, leaving the footer
      // below the fold. That residue measured 95px, past the 80px at-bottom
      // threshold, so the pill would never clear its unread count.
      if (scroller !== null) scroller.scrollTop = scroller.scrollHeight
    }
    settle()
  }

  const renderItem = useCallback(
    (index: number, message: Message) => {
      const previous = messages[index - 1]
      const next = messages[index + 1]
      const isGrouped =
        previous !== undefined &&
        previous.role === message.role &&
        message.timestamp - previous.timestamp < GROUP_WINDOW_MS
      const isRunEnd =
        next === undefined ||
        next.role !== message.role ||
        next.timestamp - message.timestamp >= GROUP_WINDOW_MS

      return (
        <div className="mx-auto w-full max-w-content px-4">
          <MessageBubble
            message={message}
            isGrouped={isGrouped}
            showTimestamp={isRunEnd}
            onRetry={onRetry}
          />
        </div>
      )
    },
    [messages, onRetry],
  )

  if (messages.length === 0) return <EmptyState />

  return (
    <div className="relative h-full">
      <Virtuoso<Message, ListContext>
        ref={virtuosoRef}
        scrollerRef={(element) => {
          setScroller(element instanceof HTMLElement ? element : null)
        }}
        className="chat-scroller h-full"
        role="log"
        // Virtuoso makes the scroller focusable so it can be scrolled from the
        // keyboard. Without a name, that stop announces itself as the run-together
        // text of every rendered message.
        aria-label="Message history"
        // Explicitly off: the announcing is done by LiveAnnouncer, which holds
        // one message rather than re-reading rows as they recycle.
        aria-live="off"
        data={messages}
        context={{ isBotTyping }}
        itemContent={renderItem}
        components={{ Footer: ListFooter }}
        // Off deliberately. Virtuoso's follow scrolls to the last row's edge
        // before that row is measured, landing ~95px short of the true bottom.
        // That short landing emits a scroll event past the at-bottom threshold,
        // which switched off the resize-driven pin above and let a burst of
        // twenty drift 1300px behind. One mechanism owns the scroll position.
        followOutput={false}
        atBottomStateChange={handleAtBottomStateChange}
        atBottomThreshold={AT_BOTTOM_THRESHOLD_PX}
        initialTopMostItemIndex={initialIndexRef.current ?? 0}
        increaseViewportBy={{ top: VIEWPORT_OVERSCAN_PX, bottom: VIEWPORT_OVERSCAN_PX }}
      />
      {!isAtBottom && (
        <ScrollToBottomPill unreadCount={unreadCount} onScrollToBottom={handleScrollToBottom} />
      )}
    </div>
  )
}
