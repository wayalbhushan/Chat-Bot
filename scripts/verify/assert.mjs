// Shared assertions for the verification scripts.
//
// A selector for a conditionally-present element is indistinguishable from one
// that is simply wrong: both read as "not there". A renamed aria-label went
// unnoticed for exactly that reason, because the branch that never matched was
// treated as a legitimate absence. These helpers make a selector that matches
// nothing for a whole run fail the script instead.

const tracked = new Map()

/** Registers a selector expected to match at least once before the run ends. */
export function trackSelector(name, selector) {
  if (!tracked.has(name)) tracked.set(name, { selector, matched: false })
  return selector
}

/** Records that a tracked selector matched. Pass the value a probe read back. */
export function recordMatch(name, value) {
  const entry = tracked.get(name)
  if (entry !== undefined && value !== null && value !== undefined) entry.matched = true
  return value
}

/** Fails when an element that must exist right now does not. */
export async function requireElement(page, selector, label) {
  const count = await page.locator(selector).count()
  if (count === 0) throw new Error(`Expected ${label} to exist, but "${selector}" matched nothing`)
  return count
}

/** Call before reporting results: any never-matched selector is likely stale. */
export function assertTrackedSelectorsMatched() {
  const stale = [...tracked.entries()].filter(([, entry]) => !entry.matched)
  if (stale.length > 0) {
    const detail = stale.map(([name, entry]) => `${name} => ${entry.selector}`).join('; ')
    throw new Error(
      `Selector never matched anything during this run, so its assertions proved nothing: ${detail}`,
    )
  }
}
