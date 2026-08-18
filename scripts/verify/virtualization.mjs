// Verification script for the virtualization and scroll performance behaviour described in the README.
// Requires the dev server on :5173 and Playwright, which is deliberately not a
// project dependency so a reviewer's install stays light:
//   npm i -D playwright && npx playwright install chromium
//   node scripts/verify/virtualization.mjs

import { chromium } from 'playwright'

const URL = 'http://localhost:5173/'
const out = {}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-index]', { timeout: 20000 })
await page.waitForTimeout(1500)

// Load the stress dataset through the UI, so this measures 10,000 messages
// rather than whatever history the browser profile happened to carry.
await page.click('button[aria-label="Load 10,000 demo messages"]')
await page.waitForTimeout(3000)

const scroller = '[data-testid="virtuoso-scroller"]'

out.render = await page.evaluate((sel) => {
  const items = document.querySelectorAll('[data-index]')
  const idx = [...items].map((i) => +i.getAttribute('data-index'))
  const sc = document.querySelector(sel)
  return {
    renderedRows: items.length,
    totalDomNodes: document.getElementsByTagName('*').length,
    minIndex: Math.min(...idx),
    maxIndex: Math.max(...idx),
    scrollTop: Math.round(sc.scrollTop),
    scrollHeight: sc.scrollHeight,
    clientHeight: sc.clientHeight,
    atBottom: sc.scrollHeight - sc.scrollTop - sc.clientHeight < 5,
  }
}, scroller)

// Frame timing while scrolling hard through the full 10k range.
out.scrollPerf = await page.evaluate(async (sel) => {
  const sc = document.querySelector(sel)
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
  const total = sc.scrollHeight - sc.clientHeight
  for (let i = 0; i <= 60; i++) {
    sc.scrollTop = (total * i) / 60
    await new Promise((r) => setTimeout(r, 30))
  }
  running = false
  await new Promise((r) => setTimeout(r, 100))
  const sorted = [...frames].sort((a, b) => a - b)
  return {
    frameCount: frames.length,
    maxFrameMs: Math.round(Math.max(...frames)),
    p95FrameMs: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
    framesOver50ms: frames.filter((f) => f > 50).length,
    rowsAfterScroll: document.querySelectorAll('[data-index]').length,
  }
}, scroller)

out.peakRows = await page.evaluate((sel) => {
  const sc = document.querySelector(sel)
  let peak = 0
  sc.scrollTop = sc.scrollHeight / 2
  peak = Math.max(peak, document.querySelectorAll('[data-index]').length)
  return { midListRows: peak }
}, scroller)

await page.screenshot({ path: 'scripts/verify/output/stress-10k.png' })
console.log(JSON.stringify(out, null, 1))
await browser.close()
