// Verification script for the persistence, recovery and quota behaviour described in the README.
// Requires the dev server on :5173 and Playwright, which is deliberately not a
// project dependency so a reviewer's install stays light:
//   npm i -D playwright && npx playwright install chromium
//   node scripts/verify/persistence.mjs

import { chromium } from 'playwright'

const URL = 'http://localhost:5173/'
const KEY = 'darwix-chat-history-v1'
const out = {}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)))

const stored = () =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k)
    if (raw === null) return { present: false }
    try {
      const parsed = JSON.parse(raw)
      return {
        present: true,
        bytes: raw.length,
        count: Array.isArray(parsed) ? parsed.length : null,
        statuses: Array.isArray(parsed) ? [...new Set(parsed.map((m) => m.status))] : null,
      }
    } catch {
      return { present: true, bytes: raw.length, unparseable: true }
    }
  }, KEY)

const rows = () => page.locator('[data-index]').count()
const bodyText = () => page.evaluate(() => document.body.innerText)

const send = async (text) => {
  await page.fill('textarea', text)
  await page.press('textarea', 'Enter')
}

// 1. Fresh load starts empty and writes nothing yet.
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
out.freshLoad = { text: (await bodyText()).includes('No messages yet'), storage: await stored() }

// 2. Send messages, then reload: history restored, scrolled to newest.
await send('persist one')
await page.waitForTimeout(4000)
await send('persist two')
await page.waitForTimeout(4500)
out.beforeReload = { rows: await rows(), storage: await stored() }

await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
out.afterReload = {
  rows: await rows(),
  hasFirst: (await bodyText()).includes('persist one'),
  hasSecond: (await bodyText()).includes('persist two'),
  gap: await page.evaluate(() => {
    const sc = document.querySelector('[data-testid="virtuoso-scroller"]')
    return Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight)
  }),
}

// 3. Corrupt storage must load empty, not crash.
await page.evaluate((k) => localStorage.setItem(k, '{ this is not json ['), KEY)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
out.corrupt = {
  showsEmptyState: (await bodyText()).includes('No messages yet'),
  pageErrors: errors.length,
}

// 4. Wrong-shape but valid JSON is rejected too.
await page.evaluate((k) => localStorage.setItem(k, JSON.stringify([{ nope: 1 }, 'string', 42])), KEY)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
out.wrongShape = {
  showsEmptyState: (await bodyText()).includes('No messages yet'),
  pageErrors: errors.length,
}

// 5. An interrupted send must persist as failed, not sending.
await page.evaluate(
  ({ k }) => {
    const now = Date.now()
    localStorage.setItem(
      k,
      JSON.stringify([
        { id: 'a1', role: 'user', text: 'interrupted mid-send', timestamp: now, status: 'sending' },
      ]),
    )
  },
  { k: KEY },
)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
out.interruptedSend = {
  showsNotDelivered: (await bodyText()).includes('Not delivered'),
  hasRetryButton: (await page.locator('button', { hasText: 'Retry' }).count()) > 0,
}

// 6. Clear chat: two-step confirm, then survives reload.
await send('to be cleared')
await page.waitForTimeout(4000)
const beforeClear = await stored()
await page.click('button[aria-label="Clear chat history"]')
const confirmVisible = (await bodyText()).includes('Clear all?')
await page.click('button:has-text("Clear")')
await page.waitForTimeout(800)
out.clear = {
  confirmStepShown: confirmVisible,
  storedBefore: beforeClear.count,
  emptyAfter: (await bodyText()).includes('No messages yet'),
  storageAfter: await stored(),
}
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
out.clear.survivesReload = (await bodyText()).includes('No messages yet')

// 7. Load 10k must never reach localStorage.
await send('real history kept')
await page.waitForTimeout(4000)
const beforeStress = await stored()
await page.click('button[aria-label="Load 10,000 demo messages"]')
await page.waitForTimeout(3000)
out.stress = {
  storageBeforeStress: beforeStress,
  rowsRendered: await rows(),
  storageAfterStress: await stored(),
}
await page.waitForTimeout(2000)
out.stress.storageAfterSettle = await stored()

out.pageErrors = errors
console.log(JSON.stringify(out, null, 1))
await browser.close()
