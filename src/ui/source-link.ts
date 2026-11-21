/** Link to the source code of the served build: the exact commit when known, else the repo root. */
export function sourceCodeUrl(repoUrl: string | null, sha: string | null): string | null {
  if (!repoUrl) return null
  return sha ? `${repoUrl}/tree/${sha}` : repoUrl
}

/**
 * {@link sourceCodeUrl} applied to the values injected at build time. Written
 * inline over the constants so the minifier folds it into one literal URL in
 * `dist/` (the network checks of story 1.4 allowlist that exact string).
 */
export function currentSourceCodeUrl(): string | null {
  if (!__REPO_URL__) return null
  return __COMMIT_SHA__ ? `${__REPO_URL__}/tree/${__COMMIT_SHA__}` : __REPO_URL__
}
