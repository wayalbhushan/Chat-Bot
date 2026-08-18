import { ChatHeader } from './components/ChatHeader'

export function App() {
  return (
    // 100dvh rather than 100vh: mobile Safari's collapsing toolbar makes 100vh
    // taller than the visible area, which pushes the composer under the fold.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white text-slate-900">
      <ChatHeader />
      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto h-full w-full max-w-3xl px-4" />
      </main>
      <footer className="shrink-0 border-t border-slate-200">
        <div className="mx-auto w-full max-w-3xl px-4 py-3" />
      </footer>
    </div>
  )
}
