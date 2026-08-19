// Verification script for the "content changes height after the scroll decision"
// seam, which is where every scroll bug in this build originated.
// Requires the dev server on :5173 and Playwright, which is deliberately not a
// project dependency so a reviewer's install stays light:
//   npm i -D playwright && npx playwright install chromium
//   node scripts/verify/height-changes.mjs

import { chromium } from 'playwright'

const URL = 'http://localhost:5173/'
const KEY = 'darwix-chat-history-v1'
const SC = '[data-testid="virtuoso-scroller"]'
const out = {}

const browser = await chromium.launch()

const geometry = (page) =>
  page.evaluate((sel) => {
    const sc = document.querySelector(sel)
    const top = sc.getBoundingClientRect().top
    const rows = [...document.querySelectorAll('[data-index]')]
      .map((el) => ({ index: +el.getAttribute('data-index'), rect: el.getBoundingClientRect() }))
      .sort((a, b) => a.index - b.index)
    const firstVisible = rows.find((r) => r.rect.bottom > top + 1)
    return {
      scrollTop: Math.round(sc.scrollTop),
      gap: Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight),
      topVisibleIndex: firstVisible ? firstVisible.index : null,
      topVisibleOffset: firstVisible ? Math.round(firstVisible.rect.top - top) : null,
      rows: rows.length,
    }
  }, SC)

const seedHistory = async (page, { failedAt }) => {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(
    ({ key, failedAt }) => {
      const now = Date.now()
      const messages = Array.from({ length: 80 }, (_, i) => ({
        id: 'm' + i,
        role: i % 2 === 0 ? 'user' : 'bot',
        text: failedAt.includes(i) ? 'this send failed ' + i : 'seeded message number ' + i,
        // Spread far enough apart that grouping never collapses a row.
        timestamp: now - (80 - i) * 120000,
        status: failedAt.includes(i) ? 'failed' : 'sent',
      }))
      localStorage.setItem(key, JSON.stringify(messages))
    },
    { key: KEY, failedAt },
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('article')
  await page.waitForTimeout(1200)
}

// A: retry the newest message while parked at the bottom. The "Not delivered"
// row disappears, so an existing row shrinks under the viewport.
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  await seedHistory(page, { failedAt: [79] })
  const before = await geometry(page)
  await page.click('button:has-text("Retry")')
  await page.waitForTimeout(1500)
  const after = await geometry(page)
  out.retryAtBottom = { before, after, stayedPinned: after.gap <= 80 }
  await page.close()
}

// B: retry a row that is rendered but sitting above the viewport.
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  await seedHistory(page, { failedAt: [72] })
  await page.evaluate((sel) => {
    const sc = document.querySelector(sel)
    sc.scrollTop = sc.scrollHeight
  }, SC)
  await page.waitForTimeout(800)
  const before = await geometry(page)
  const retryCount = await page.locator('button:has-text("Retry")').count()
  if (retryCount > 0) {
    await page.locator('button:has-text("Retry")').first().click()
    await page.waitForTimeout(1500)
  }
  const after = await geometry(page)
  out.retryAboveViewport = {
    retryButtonRendered: retryCount > 0,
    before,
    after,
    topRowHeld: before.topVisibleIndex === after.topVisibleIndex,
  }
  await page.close()
}

// C: the typing footer is removed and a row is added in the same frame, at 10k.
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('article')
  await page.click('button[aria-label="Load 10,000 demo messages"]')
  await page.waitForTimeout(3000)
  await page.fill('textarea', 'typing seam probe')
  await page.press('textarea', 'Enter')
  const samples = []
  for (let i = 0; i < 60; i++) {
    samples.push(
      await page.evaluate((sel) => {
        const sc = document.querySelector(sel)
        return Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight)
      }, SC),
    )
    await page.waitForTimeout(100)
  }
  out.typingToReply = {
    maxGapDuringExchange: Math.max(...samples),
    finalGap: samples[samples.length - 1],
    everExceededThreshold: samples.some((g) => g > 80),
  }
  await page.close()
}

// D: resize across breakpoints while parked mid-history. Bubble max-width
// changes at sm, so every rendered row remeasures.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('article')
  await page.click('button[aria-label="Load 10,000 demo messages"]')
  await page.waitForTimeout(3000)
  await page.evaluate((sel) => {
    const sc = document.querySelector(sel)
    sc.scrollTop = Math.round(sc.scrollHeight / 2)
  }, SC)
  await page.waitForTimeout(1200)
  const before = await geometry(page)
  await page.setViewportSize({ width: 375, height: 900 })
  await page.waitForTimeout(1500)
  const after = await geometry(page)
  const hScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(1500)
  const back = await geometry(page)
  out.resizeMidScroll = {
    before,
    afterShrink: after,
    afterRestore: back,
    indexDriftOnShrink: after.topVisibleIndex === null ? null : after.topVisibleIndex - before.topVisibleIndex,
    indexDriftOnRestore: back.topVisibleIndex === null ? null : back.topVisibleIndex - before.topVisibleIndex,
    hScrollAt375: hScroll,
  }
  await ctx.close()
}

console.log(JSON.stringify(out, null, 1))
await browser.close()
