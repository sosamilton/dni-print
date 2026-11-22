import { expect } from 'vitest'

/** Body of the first `selector { … }` block after `from` (blocks hold declarations only). */
export function blockAfter(css: string, selector: string, from = 0): string {
  const at = css.indexOf(selector, from)
  expect(at, selector).toBeGreaterThan(-1)
  const open = css.indexOf('{', at + selector.length)
  return css.slice(open + 1, css.indexOf('}', open))
}

/**
 * Splits tokens.css into the base `:root` block and the two dark blocks (CAP-6):
 * `prefers-color-scheme: dark` without `data-theme="light"`, and `[data-theme="dark"]`.
 */
export function splitTokens(css: string): { light: string; systemDark: string; explicitDark: string } {
  const media = css.indexOf('@media (prefers-color-scheme: dark)')
  expect(media).toBeGreaterThan(-1)
  return {
    light: css.slice(0, media),
    systemDark: blockAfter(css, ":root:not([data-theme='light'])", media),
    explicitDark: blockAfter(css, ":root[data-theme='dark']"),
  }
}
