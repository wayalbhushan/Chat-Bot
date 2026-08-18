import { useCallback, useEffect, useRef, useState } from 'react'
import { Virtuoso, type Components, type VirtuosoHandle } from 'react-virtuoso'
import type { Message } from '../types'
import { EmptyState } from './EmptyState'
import { MessageBubble } from './MessageBubble'
import { ScrollToBottomPill } from './ScrollToBottomPill'
import { TypingIndicator } from './TypingIndicator'
import { GROUP_WINDOW_MS } from '../lib/time'

const AT_BOTTOM_THRESHOLD_PX = 80
const VIEWPORT_OVERSCAN_PX = 400

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
  <div className="mx-auto w-full max-w-3xl px-4 pb-3">
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
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const previousCountRef = useRef(messages.length)

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
    virtuosoRef.current?.scrollToIndex({
      index: messages.length - 1,
      align: 'end',
      behavior: 'smooth',
    })
  }

  const renderItem = useCallback(
    (index: number, message: Message) => {
      const previous = messages[index - 1]
      const isGrouped =
        previous !== undefined &&
        previous.role === message.role &&
        message.timestamp - previous.timestamp < GROUP_WINDOW_MS

      return (
        <div className="mx-auto w-full max-w-3xl px-4">
          <MessageBubble message={message} isGrouped={isGrouped} onRetry={onRetry} />
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
        className="h-full"
        data={messages}
        context={{ isBotTyping }}
        itemContent={renderItem}
        components={{ Footer: ListFooter }}
        // Reading atBottom from the callback rather than component state keeps
        // the decision current at the moment the data changes.
        followOutput={(atBottom) => (atBottom ? 'smooth' : false)}
        atBottomStateChange={handleAtBottomStateChange}
        atBottomThreshold={AT_BOTTOM_THRESHOLD_PX}
        initialTopMostItemIndex={Math.max(messages.length - 1, 0)}
        increaseViewportBy={{ top: VIEWPORT_OVERSCAN_PX, bottom: VIEWPORT_OVERSCAN_PX }}
      />
      {!isAtBottom && (
        <ScrollToBottomPill unreadCount={unreadCount} onScrollToBottom={handleScrollToBottom} />
      )}
    </div>
  )
}
