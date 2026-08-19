// Verification script for sends driven through the composer UI (real typing and
// Enter presses) rather than through state, which is how the auto-grow height
// change participates in the scroll seam.
// Requires the dev server on :5173 and Playwright, which is deliberately not a
// project dependency so a reviewer's install stays light:
//   npm i -D playwright && npx playwright install chromium
//   node scripts/verify/composer-sends.mjs

import { chromium } from 'playwright'

const URL = 'http://localhost:5173/'
const SC = '[data-testid="virtuoso-scroller"]'
const PILL = 'main button[aria-label*="new message"], main button[aria-label*="ump to latest"]'
const out = {}

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('article')
await page.click('button[aria-label="Load 10,000 demo messages"]')
await page.waitForTimeout(3000)

const probe = () =>
  page.evaluate(
    ({ sel, pillSel }) => {
      const sc = document.querySelector(sel)
      const ta = document.querySelector('textarea')
      return {
        gap: Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight),
        scrollerH: sc.clientHeight,
        textareaH: Math.round(ta.getBoundingClientRect().height),
        footerH: Math.round(document.querySelector('footer').getBoundingClientRect().height),
        pill: document.querySelector(pillSel)?.getAttribute('aria-label') ?? null,
      }
    },
    { sel: SC, pillSel: PILL },
  )

// Typed one character at a time so the auto-grow layout effect runs per
// keystroke, exactly as it does for a person.
const typeAndSend = async (text) => {
  await page.click('textarea')
  await page.keyboard.type(text, { delay: 12 })
  const beforeEnter = await probe()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  const afterSend = await probe()
  await page.waitForTimeout(4000)
  const afterReply = await probe()
  return { beforeEnter, afterSend, afterReply }
}

out.singleShort = await typeAndSend('short one')

// Grow the box past three lines before sending.
await page.click('textarea')
for (const line of ['first line', 'second line', 'third line', 'fourth line']) {
  await page.keyboard.type(line, { delay: 12 })
  await page.keyboard.press('Shift+Enter')
}
await page.keyboard.type('fifth line', { delay: 12 })
const grown = await probe()
await page.keyboard.press('Enter')
await page.waitForTimeout(1200)
const afterGrownSend = await probe()
await page.waitForTimeout(4000)
out.afterGrowth = { grown, afterSend: afterGrownSend, afterReply: await probe() }

const consecutive = []
for (let i = 0; i < 5; i++) {
  await page.click('textarea')
  await page.keyboard.type('consecutive ' + i, { delay: 12 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  consecutive.push(await probe())
}
await page.waitForTimeout(6000)
out.fiveInARow = { perSend: consecutive, settled: await probe() }

console.log(JSON.stringify(out, null, 1))
await browser.close()
