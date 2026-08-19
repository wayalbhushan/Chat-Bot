// Verification script for the scroll anchoring and unread pill behaviour described in the README.
// Requires the dev server on :5173 and Playwright, which is deliberately not a
// project dependency so a reviewer's install stays light:
//   npm i -D playwright && npx playwright install chromium
//   node scripts/verify/scroll-anchoring.mjs

import { chromium } from 'playwright'
import {
  assertTrackedSelectorsMatched,
  recordMatch,
  requireElement,
  trackSelector,
} from './assert.mjs'

const URL = 'http://localhost:5173/'
const SC = '[data-testid="virtuoso-scroller"]'
const PILL = trackSelector(
  'unread pill',
  'main button[aria-label*="new message"], main button[aria-label*="ump to latest"]',
)
const out = {}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-index]', { timeout: 20000 })
await page.waitForTimeout(1500)

// Anchoring only means anything on a list long enough to scroll away from.
await requireElement(page, 'button[aria-label="Load 10,000 demo messages"]', 'the 10k demo control')
await requireElement(page, 'textarea', 'the composer input')
await page.click('button[aria-label="Load 10,000 demo messages"]')
await page.waitForTimeout(3000)

const probe = () =>
  page.evaluate(
    ({ sel, pillSel }) => {
      const sc = document.querySelector(sel)
      const idx = [...document.querySelectorAll('[data-index]')].map((i) => +i.getAttribute('data-index'))
      const pill = document.querySelector(pillSel)
      return {
        scrollTop: Math.round(sc.scrollTop),
        gap: Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight),
        rows: idx.length,
        maxIndex: idx.length ? Math.max(...idx) : null,
        pillLabel: pill ? pill.getAttribute('aria-label') : null,
      }
    },
    { sel: SC, pillSel: PILL },
  ).then((result) => {
    recordMatch('unread pill', result.pillLabel)
    return result
  })

const send = async (text) => {
  await page.fill('textarea', text)
  await page.press('textarea', 'Enter')
}

// 1. Opens at the newest message after load.
out.onLoad = await probe()

// 2. Scrolled up: incoming messages must not move the viewport.
await page.evaluate((sel) => {
  document.querySelector(sel).scrollTop = Math.round(document.querySelector(sel).scrollHeight / 2)
}, SC)
await page.waitForTimeout(700)
const parked = await probe()
await send('anchor probe')
await page.waitForTimeout(4000)
const afterIncoming = await probe()
out.anchoring = {
  scrollTopBefore: parked.scrollTop,
  scrollTopAfter: afterIncoming.scrollTop,
  viewportMoved: parked.scrollTop !== afterIncoming.scrollTop,
  pillLabel: afterIncoming.pillLabel,
}

// 3. Pill click returns to the true bottom and clears the count.
await page.click(PILL)
await page.waitForTimeout(1500)
const afterPill = await probe()
out.pillClick = { gap: afterPill.gap, pillGone: afterPill.pillLabel === null, maxIndex: afterPill.maxIndex }

// 3b. The same click from a short distance takes a different code path, and
// only the long-distance one was covered before.
const nearJumps = []
for (const up of [400, 900, 1600]) {
  await page.evaluate(
    ({ sel, up }) => {
      const sc = document.querySelector(sel)
      sc.scrollTop = sc.scrollHeight - sc.clientHeight - up
    },
    { sel: SC, up },
  )
  await page.waitForTimeout(900)
  const before = await probe()
  await page.click(PILL)
  await page.waitForTimeout(1800)
  const after = await probe()
  nearJumps.push({ scrolledUpPx: up, gapBefore: before.gap, gapAfter: after.gap, pillCleared: after.pillLabel === null })
}
out.nearPillJumps = nearJumps

// 4. At bottom, a new message scrolls itself into view.
const beforeFollow = await probe()
await send('follow probe')
await page.waitForTimeout(4500)
const afterFollow = await probe()
out.followsAtBottom = {
  maxIndexBefore: beforeFollow.maxIndex,
  maxIndexAfter: afterFollow.maxIndex,
  grew: afterFollow.maxIndex > beforeFollow.maxIndex,
  gap: afterFollow.gap,
  pillStayedHidden: afterFollow.pillLabel === null,
}

// 5. Burst of 20 through the composer.
await page.evaluate(() => {
  const frames = []
  let last = performance.now()
  let running = true
  const tick = () => {
    const now = performance.now()
    frames.push(now - last)
    last = now
    if (running) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  window.__b = { frames, stop: () => (running = false) }
})
for (let i = 0; i < 20; i++) await send('burst ' + i)
await page.waitForTimeout(3000)
out.burst = await page.evaluate(() => {
  const { frames, stop } = window.__b
  stop()
  const sorted = [...frames].sort((a, b) => a - b)
  return {
    frames: frames.length,
    maxFrameMs: Math.round(Math.max(...frames)),
    p95FrameMs: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
    framesOver50ms: frames.filter((f) => f > 50).length,
  }
})
out.afterBurst = await probe()

await page.screenshot({ path: 'scripts/verify/output/final-bottom.png' })
assertTrackedSelectorsMatched()
console.log(JSON.stringify(out, null, 1))
await browser.close()
