import { execFileSync } from 'node:child_process'

/** Source of git facts, injectable so the resolver can be tested without git. */
export interface GitInfo {
  sha(): string | null
  remoteUrl(): string | null
}

export interface BuildInfo {
  /** Commit SHA of the served build, or null when unknown. */
  sha: string | null
  /** Repository base URL (https, no trailing slash nor `.git`), or null when unknown. */
  repoUrl: string | null
}

export type BuildEnv = Record<string, string | undefined>

const SSH_REMOTE = /^git@([^\s:/]+):([^\s]+)$/
const SHA = /^[0-9a-f]{1,64}$/i

function stripRepoSuffix(path: string): string {
  return path.replace(/\/+$/, '').replace(/\.git$/, '').replace(/\/+$/, '')
}

/**
 * Turns a git remote or repository URL into `https://host/owner/repo`.
 * Accepts SSH (`git@host:o/r(.git)`) and `https://…(.git)(/)`; any other
 * scheme (http, javascript, ssh://, file…) yields null. Credentials are dropped.
 */
export function normalizeRepoUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null

  const ssh = SSH_REMOTE.exec(value)
  if (ssh) {
    const path = stripRepoSuffix(ssh[2]).replace(/^\/+/, '')
    return path ? `https://${ssh[1]}/${path}` : null
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !url.hostname) return null
  const path = stripRepoSuffix(url.pathname)
  if (!path || path === '/') return null
  return `https://${url.host}${path}`
}

function normalizeSha(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  return value && SHA.test(value) ? value.toLowerCase() : null
}

function githubRepoUrl(env: BuildEnv): string | null {
  const server = env.GITHUB_SERVER_URL?.trim().replace(/\/+$/, '')
  const repository = env.GITHUB_REPOSITORY?.trim().replace(/^\/+/, '')
  return server && repository ? normalizeRepoUrl(`${server}/${repository}`) : null
}

/**
 * Resolves the commit SHA and repository URL injected into the build.
 * SHA: VITE_COMMIT_SHA → GITHUB_SHA → git HEAD → null.
 * Repo: VITE_REPO_URL → GITHUB_SERVER_URL/GITHUB_REPOSITORY → git origin → null.
 * Invalid candidates are discarded and the next source is tried. Never throws.
 */
export function resolveBuildInfo(env: BuildEnv, git: GitInfo): BuildInfo {
  const sha = normalizeSha(env.VITE_COMMIT_SHA) ?? normalizeSha(env.GITHUB_SHA) ?? normalizeSha(safe(() => git.sha()))
  const repoUrl =
    normalizeRepoUrl(env.VITE_REPO_URL) ?? githubRepoUrl(env) ?? normalizeRepoUrl(safe(() => git.remoteUrl()))
  return { sha, repoUrl }
}

function safe(read: () => string | null): string | null {
  try {
    return read()
  } catch {
    return null
  }
}

function runGit(args: string[]): string | null {
  try {
    const output = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return output || null
  } catch {
    return null
  }
}

/** Reads HEAD and the `origin` remote from the git CLI; null when git or the remote is missing. */
export function gitFromCli(): GitInfo {
  return {
    sha: () => runGit(['rev-parse', 'HEAD']),
    remoteUrl: () => runGit(['remote', 'get-url', 'origin']),
  }
}
