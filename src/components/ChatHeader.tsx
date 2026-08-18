import { MessageSquare } from 'lucide-react'

export function ChatHeader() {
  return (
    <header className="shrink-0 border-b border-slate-200">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100">
          <MessageSquare className="h-4 w-4 text-blue-600" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-header font-semibold leading-5">Assistant</span>
          <span className="text-meta leading-4 text-slate-500">Online</span>
        </div>
      </div>
    </header>
  )
}
