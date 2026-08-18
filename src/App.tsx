import { MessageSquare } from 'lucide-react'

export function App() {
  return (
    <div className="flex h-full flex-col bg-white text-slate-900">
      <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <MessageSquare className="h-4 w-4 text-blue-600" />
        <h1 className="text-header font-semibold">Chat</h1>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-meta text-slate-500">No messages yet</p>
      </main>
    </div>
  )
}
