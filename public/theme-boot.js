/*
 * Applies the saved theme before the first paint (CAP-6). Classic, blocking,
 * same-origin script: the CSP forbids inline scripts. It cannot import
 * src/ui/preferences.ts, so the key and the validation are duplicated here
 * (tests/ui/theme-boot.test.ts checks parity). It never throws.
 */
(function () {
  try {
    var raw = null
    try {
      raw = window.localStorage.getItem('dni-print:prefs')
    } catch {
      return
    }
    if (!raw) return
    var data = JSON.parse(raw)
    if (!data || typeof data !== 'object' || data.v !== 1) return
    var theme = data.theme
    if (theme !== 'light' && theme !== 'dark') return
    document.documentElement.setAttribute('data-theme', theme)
    // Both theme-color metas take the content of the chosen scheme's meta; the original goes to data-content.
    var metas = document.querySelectorAll('meta[name="theme-color"]')
    var color = null
    var i
    for (i = 0; i < metas.length; i++) {
      var media = metas[i].getAttribute('media') || ''
      if (media.indexOf('prefers-color-scheme: ' + theme) !== -1) color = metas[i].getAttribute('content')
    }
    if (color === null) return
    for (i = 0; i < metas.length; i++) {
      if (!metas[i].hasAttribute('data-content')) metas[i].setAttribute('data-content', metas[i].getAttribute('content') || '')
      metas[i].setAttribute('content', color)
    }
  } catch {
    // Broken value or unexpected DOM: keep following the system theme.
  }
})()
