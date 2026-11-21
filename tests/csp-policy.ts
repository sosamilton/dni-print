/** Content-Security-Policy required by AD-7, verbatim. */
export const AD7_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; img-src 'self' blob: data:; worker-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'"

/** CSP the build is expected to serve: AD-7, plus `'unsafe-eval'` for the `opencv` engine build. */
export function expectedCsp(engine: string | undefined = process.env.VITE_DETECTION_ENGINE): string {
  return engine?.trim() === 'opencv'
    ? AD7_CSP.replace("'wasm-unsafe-eval'", "'wasm-unsafe-eval' 'unsafe-eval'")
    : AD7_CSP
}
