// Verification script for the colour contrast and DOM node count behaviour described in the README.
// Requires the dev server on :5173 and Playwright, which is deliberately not a
// project dependency so a reviewer's install stays light:
//   npm i -D playwright && npx playwright install chromium
//   node scripts/verify/contrast.mjs

import { chromium } from 'playwright'

const URL = 'http://localhost:5173/'
const out = {}

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('article', { timeout: 20000 })
await page.waitForTimeout(1500)

// Rasterise each colour to real sRGB pixels: computed styles come back as
// oklch() under Tailwind v4, which cannot be parsed as rgb triplets.
out.contrast = await page.evaluate(() => {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const toRgb = (color) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b]
  }
  const lum = ([r, g, b]) =>
    [r, g, b]
      .map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0)
  const ratio = (fg, bg) => {
    const a = lum(toRgb(fg))
    const b = lum(toRgb(bg))
    return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2))
  }
  const bgOf = (el) => {
    let node = el
    while (node) {
      const bg = getComputedStyle(node).backgroundColor
      const [, , , alpha] = toRgb(bg).concat(1)
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && alpha !== 0) return bg
      node = node.parentElement
    }
    return 'rgb(255,255,255)'
  }
  const result = {}
  const add = (key, el, colorOverride) => {
    if (!el) {
      result[key] = 'NOT FOUND'
      return
    }
    const style = getComputedStyle(el)
    const r = ratio(colorOverride ?? style.color, bgOf(el))
    const px = parseFloat(style.fontSize)
    const bold = Number(style.fontWeight) >= 700
    const large = px >= 24 || (px >= 18.66 && bold)
    result[key] = { ratio: r, px, required: large ? 3 : 4.5, passes: r >= (large ? 3 : 4.5) }
  }
  const byText = (sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === text)
  add('timestamp', document.querySelector('time'))
  add('headerTitle', byText('header span', 'Assistant'))
  add('headerOnline', byText('header span', 'Online'))
  add('botBubbleText', document.querySelector('article .bg-slate-100'))
  add('userBubbleText', document.querySelector('article .bg-blue-600'))
  add('demoButton', document.querySelector('button[aria-label="Load 10,000 demo messages"]'))
  add('clearIcon', document.querySelector('button[aria-label="Clear chat history"]'))
  // Read from the pseudo-element: a hardcoded colour here silently kept
  // reporting the old token after the palette was darkened.
  const ta = document.querySelector('textarea')
  add('placeholder', ta, getComputedStyle(ta, '::placeholder').color)
  add('composerText', ta)
  return result
})

// The failed-message row only exists after a failure, so force one.
out.failedRowContrast = await page.evaluate(async () => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const toRgb = (color) => {
    ctx.fillStyle = '#000'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
  }
  const lum = (rgb) =>
    rgb
      .map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0)
  const ratio = (fg, bg) => {
    const a = lum(toRgb(fg))
    const b = lum(toRgb(bg))
    return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2))
  }
  return {
    redText: ratio('oklch(0.577 0.245 27.325)', 'rgb(255,255,255)'),
    retryLink: ratio('oklch(0.546 0.245 262.881)', 'rgb(255,255,255)'),
  }
})

// The number: article count with 10,000 messages loaded.
await page.click('button[aria-label="Load 10,000 demo messages"]')
await page.waitForTimeout(3500)
out.at10k = {
  articleCount: await page.locator('article').count(),
  dataIndexRows: await page.locator('[data-index]').count(),
  totalDomNodes: await page.evaluate(() => document.getElementsByTagName('*').length),
  scrollHeightPx: await page.evaluate(
    () => document.querySelector('[data-testid="virtuoso-scroller"]').scrollHeight,
  ),
}
await page.screenshot({ path: 'scripts/verify/output/article-count-10k.png' })

await page.evaluate(() => {
  const sc = document.querySelector('[data-testid="virtuoso-scroller"]')
  sc.scrollTop = sc.scrollHeight / 2
})
await page.waitForTimeout(1500)
out.at10kMidList = {
  articleCount: await page.locator('article').count(),
  totalDomNodes: await page.evaluate(() => document.getElementsByTagName('*').length),
}
out.listAria = await page.evaluate(() => {
  const sc = document.querySelector('[data-testid="virtuoso-scroller"]')
  return { role: sc.getAttribute('role'), ariaLive: sc.getAttribute('aria-live'), ariaLabel: sc.getAttribute('aria-label'), tabIndex: sc.tabIndex }
})

console.log(JSON.stringify(out, null, 1))
await browser.close()
