/** Content-Security-Policy required by AD-7, verbatim. */
export const AD7_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; img-src 'self' blob: data:; worker-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'"
