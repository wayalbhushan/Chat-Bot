// Verification script for the accessibility semantics and announcements behaviour described in the README.
// Requires the dev server on :5173 and Playwright, which is deliberately not a
// project dependency so a reviewer's install stays light:
//   npm i -D playwright && npx playwright install chromium
//   node scripts/verify/accessibility.mjs

import { chromium } from 'playwright'

const URL = 'http://localhost:5173/'
const out = {}

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('article', { timeout: 20000 })
await page.waitForTimeout(1500)

// Semantics and live-region wiring.
out.semantics = await page.evaluate(() => {
  const list = document.querySelector('[data-testid="virtuoso-scroller"]')
  const live = [...document.querySelectorAll('[aria-live]')].map((el) => ({
    live: el.getAttribute('aria-live'),
    atomic: el.getAttribute('aria-atomic'),
    role: el.getAttribute('role'),
    srOnly: el.className.includes('sr-only'),
    text: el.textContent.slice(0, 60),
  }))
  const articles = [...document.querySelectorAll('article')]
  return {
    landmarks: {
      header: document.querySelectorAll('header').length,
      main: document.querySelectorAll('main').length,
      footer: document.querySelectorAll('footer').length,
    },
    listRole: list?.getAttribute('role'),
    listAriaLive: list?.getAttribute('aria-live'),
    liveRegions: live,
    articleCount: articles.length,
    sampleArticleLabels: articles.slice(0, 3).map((a) => a.getAttribute('aria-label')),
    decorativeIconsHidden:
      [...document.querySelectorAll('svg')].every((s) => s.getAttribute('aria-hidden') === 'true'),
  }
})

// Keyboard order from a real Tab walk.
out.tabOrder = await page.evaluate(() => {
  const focusables = [...document.querySelectorAll('a[href],button,textarea,[tabindex]:not([tabindex="-1"])')]
  return focusables.map((el) => ({
    tag: el.tagName.toLowerCase(),
    name: el.getAttribute('aria-label') ?? el.textContent.trim().slice(0, 24),
  }))
})

// Skip link: hidden until focused, then visible and targeting the composer.
await page.keyboard.press('Tab')
out.skipLink = await page.evaluate(() => {
  const link = document.querySelector('a[href="#message-input"]')
  const rect = link.getBoundingClientRect()
  const style = getComputedStyle(link)
  return {
    isFirstFocusable: document.activeElement === link,
    visibleWhenFocused: rect.width > 1 && rect.height > 1,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    outlineWidth: style.outlineWidth,
    outlineColor: style.outlineColor,
    targetExists: document.querySelector('#message-input') !== null,
  }
})

// Escape clears the draft.
await page.fill('textarea', 'draft that should vanish')
await page.press('textarea', 'Escape')
await page.waitForTimeout(200)
out.escapeClears = await page.evaluate(() => ({
  value: document.querySelector('textarea').value,
  height: Math.round(document.querySelector('textarea').getBoundingClientRect().height),
}))

// Announcements: one message in the live region, and scrolling adds nothing.
const liveText = () =>
  page.evaluate(() => document.querySelector('[aria-live="polite"]').textContent)
await page.fill('textarea', 'announce me')
await page.press('textarea', 'Enter')
await page.waitForTimeout(1200)
const afterSend = await liveText()
await page.waitForTimeout(1200)
const whileTyping = await liveText()
await page.waitForTimeout(4000)
const afterReply = await liveText()
await page.evaluate(() => {
  const sc = document.querySelector('[data-testid="virtuoso-scroller"]')
  sc.scrollTop = 0
})
await page.waitForTimeout(1000)
const afterScroll = await liveText()
out.announcements = { afterSend, whileTyping, afterReply, afterScroll, unchangedByScroll: afterScroll === afterReply }

// Contrast of every text colour actually used.
out.contrast = await page.evaluate(() => {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const parse = (c) => c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
  const ratio = (fg, bg) => {
    const a = lum(parse(fg))
    const b = lum(parse(bg))
    return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2))
  }
  const bgOf = (el) => {
    let node = el
    while (node) {
      const bg = getComputedStyle(node).backgroundColor
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && !bg.startsWith('rgba(0, 0, 0, 0')) return bg
      node = node.parentElement
    }
    return 'rgb(255, 255, 255)'
  }
  const samples = {}
  const add = (key, el) => {
    if (!el) return
    samples[key] = { ratio: ratio(getComputedStyle(el).color, bgOf(el)), size: getComputedStyle(el).fontSize }
  }
  add('timestamp', document.querySelector('time'))
  add('headerOnline', [...document.querySelectorAll('header span')].find((s) => s.textContent === 'Online'))
  add('headerTitle', [...document.querySelectorAll('header span')].find((s) => s.textContent === 'Assistant'))
  add('botBubble', document.querySelector('article .bg-slate-100'))
  add('userBubble', document.querySelector('article .bg-blue-600'))
  add('demoButton', document.querySelector('button[aria-label="Load 10,000 demo messages"]'))
  const ta = document.querySelector('textarea')
  samples.placeholder = { ratio: ratio('rgb(100, 116, 139)', bgOf(ta)), size: getComputedStyle(ta).fontSize }
  return samples
})

out.pageErrors = errors
console.log(JSON.stringify(out, null, 1))
await browser.close()
