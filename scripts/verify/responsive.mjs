// Verification script for the responsive layout and tap targets behaviour described in the README.
// Requires the dev server on :5173 and Playwright, which is deliberately not a
// project dependency so a reviewer's install stays light:
//   npm i -D playwright && npx playwright install chromium
//   node scripts/verify/responsive.mjs

import { chromium } from 'playwright'

const URL = 'http://localhost:5173/'
const WIDTHS = [320, 375, 768, 1024, 1440]
const out = {}

const browser = await chromium.launch()

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)))
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('article', { timeout: 20000 })
  await page.waitForTimeout(1200)

  const base = await page.evaluate(() => {
    const doc = document.documentElement
    const header = document.querySelector('header')
    const scroller = document.querySelector('[data-testid="virtuoso-scroller"]')
    const widestBubble = Math.max(
      ...[...document.querySelectorAll('article > div:last-child')].map(
        (b) => b.getBoundingClientRect().width,
      ),
    )
    const targets = [...document.querySelectorAll('header button')].map((b) => {
      const r = b.getBoundingClientRect()
      return { name: b.getAttribute('aria-label') ?? b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) }
    })
    const send = document.querySelector('footer button').getBoundingClientRect()
    return {
      hScroll: doc.scrollWidth > doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      pageScrolls: doc.scrollHeight > doc.clientHeight,
      headerH: header.clientHeight,
      headerOverflows: header.firstElementChild.scrollWidth > header.firstElementChild.clientWidth,
      bubblePctOfList: Math.round((widestBubble / scroller.clientWidth) * 100),
      headerTargets: targets,
      sendButton: { w: Math.round(send.width), h: Math.round(send.height) },
    }
  })

  // Confirm state is the widest the header ever gets.
  await page.click('button[aria-label="Clear chat history"]')
  await page.waitForTimeout(200)
  const confirming = await page.evaluate(() => {
    const inner = document.querySelector('header').firstElementChild
    return {
      overflows: inner.scrollWidth > inner.clientWidth,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      targets: [...document.querySelectorAll('header button')].map((b) => ({
        name: b.getAttribute('aria-label') ?? b.textContent.trim(),
        h: Math.round(b.getBoundingClientRect().height),
      })),
    }
  })

  out[`${width}px`] = { ...base, confirmState: confirming, pageErrors: errors.length }
  if (width === 320 || width === 375) await page.screenshot({ path: `scripts/verify/output/responsive-${width}.png` })
  await ctx.close()
}

// Composer growth must never push the list away at the smallest width.
const ctx = await browser.newContext({ viewport: { width: 320, height: 800 } })
const page = await ctx.newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('article')
await page.fill('textarea', Array.from({ length: 12 }, (_, i) => 'line ' + i).join('\n'))
await page.waitForTimeout(400)
out.composerGrown320 = await page.evaluate(() => {
  const doc = document.documentElement
  const main = document.querySelector('main').getBoundingClientRect()
  const footer = document.querySelector('footer').getBoundingClientRect()
  const ta = document.querySelector('textarea').getBoundingClientRect()
  return {
    textareaH: Math.round(ta.height),
    mainH: Math.round(main.height),
    footerH: Math.round(footer.height),
    sumWithinViewport: Math.round(main.height + footer.height) <= window.innerHeight,
    pageScrolls: doc.scrollHeight > doc.clientHeight,
    listStillVisible: main.height > 100,
  }
})

// Typing dots are a graphical state indicator: 3:1 under WCAG 1.4.11.
out.dotContrast = await page.evaluate(() => {
  const canvas = document.createElement('canvas')
  const ctx2 = canvas.getContext('2d', { willReadFrequently: true })
  const toRgb = (c) => {
    ctx2.fillStyle = '#000'
    ctx2.fillStyle = c
    ctx2.fillRect(0, 0, 1, 1)
    return [...ctx2.getImageData(0, 0, 1, 1).data].slice(0, 3)
  }
  const lum = (rgb) =>
    rgb
      .map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
  const ratio = (fg, bg) => {
    const a = lum(toRgb(fg))
    const b = lum(toRgb(bg))
    return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2))
  }
  return {
    slate400onSlate100: ratio('oklch(0.704 0.04 256.788)', 'oklch(0.968 0.007 247.896)'),
    slate500onSlate100: ratio('oklch(0.554 0.046 257.417)', 'oklch(0.968 0.007 247.896)'),
    required: 3,
  }
})

console.log(JSON.stringify(out, null, 1))
await browser.close()
