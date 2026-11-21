import { describe, expect, it } from 'vitest'
import { normalizeRepoUrl, resolveBuildInfo, type GitInfo } from '../../scripts/build-info.ts'
import { currentSourceCodeUrl, sourceCodeUrl } from '../../src/ui/source-link.ts'

const SHA = '0123456789abcdef0123456789abcdef01234567'

function fakeGit(sha: string | null, remoteUrl: string | null): GitInfo {
  return { sha: () => sha, remoteUrl: () => remoteUrl }
}

const failingGit: GitInfo = {
  sha() {
    throw new Error('git not found')
  },
  remoteUrl() {
    throw new Error('git not found')
  },
}

function link(env: Record<string, string | undefined>, git: GitInfo): string | null {
  const { repoUrl, sha } = resolveBuildInfo(env, git)
  return sourceCodeUrl(repoUrl, sha)
}

describe('resolveBuildInfo', () => {
  it('uses the GitHub Actions variables in CI', () => {
    const env = { GITHUB_SHA: SHA, GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'o/r' }
    expect(link(env, fakeGit(null, null))).toBe(`https://github.com/o/r/tree/${SHA}`)
  })

  it('lets explicit overrides win and drops the trailing slash', () => {
    const env = {
      VITE_REPO_URL: 'https://x.org/o/r/',
      VITE_COMMIT_SHA: 'abc',
      GITHUB_SHA: SHA,
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'gh/repo',
    }
    expect(link(env, fakeGit('fff', 'git@github.com:g/g.git'))).toBe('https://x.org/o/r/tree/abc')
  })

  it('falls back to git HEAD and an SSH origin locally', () => {
    expect(link({}, fakeGit(SHA, 'git@github.com:o/r.git'))).toBe(`https://github.com/o/r/tree/${SHA}`)
  })

  it('prefers GITHUB_SHA over git HEAD', () => {
    expect(resolveBuildInfo({ GITHUB_SHA: SHA }, fakeGit('fff', null)).sha).toBe(SHA)
  })

  it('yields nulls without git nor env, without throwing', () => {
    expect(resolveBuildInfo({}, fakeGit(null, null))).toEqual({ sha: null, repoUrl: null })
    expect(resolveBuildInfo({}, failingGit)).toEqual({ sha: null, repoUrl: null })
    expect(link({}, failingGit)).toBeNull()
  })

  it('links to the repo root when the SHA is unknown', () => {
    expect(link({ VITE_REPO_URL: 'https://github.com/o/r' }, fakeGit(null, null))).toBe('https://github.com/o/r')
  })

  it('discards non-https repository URLs', () => {
    expect(resolveBuildInfo({ VITE_REPO_URL: 'javascript:alert(1)' }, fakeGit(null, null)).repoUrl).toBeNull()
    expect(resolveBuildInfo({ VITE_REPO_URL: 'http://github.com/o/r' }, fakeGit(null, null)).repoUrl).toBeNull()
  })
})

describe('normalizeRepoUrl', () => {
  it('converts SSH remotes to https', () => {
    expect(normalizeRepoUrl('git@github.com:o/r.git')).toBe('https://github.com/o/r')
    expect(normalizeRepoUrl('git@github.com:o/r')).toBe('https://github.com/o/r')
  })

  it('strips .git and trailing slashes from https URLs', () => {
    expect(normalizeRepoUrl('https://github.com/o/r.git')).toBe('https://github.com/o/r')
    expect(normalizeRepoUrl('https://github.com/o/r/')).toBe('https://github.com/o/r')
    expect(normalizeRepoUrl('https://github.com/o/r.git/')).toBe('https://github.com/o/r')
  })

  it('drops credentials embedded in the remote', () => {
    expect(normalizeRepoUrl('https://user:token@github.com/o/r.git')).toBe('https://github.com/o/r')
  })

  it('rejects any other scheme or garbage', () => {
    for (const raw of ['javascript:alert(1)', 'http://github.com/o/r', 'ssh://git@github.com/o/r.git', 'file:///repo', 'not a url', '', 'https://github.com/']) {
      expect(normalizeRepoUrl(raw), raw).toBeNull()
    }
    expect(normalizeRepoUrl(null)).toBeNull()
  })
})

describe('sourceCodeUrl', () => {
  it('builds the commit tree URL, the repo root, or null', () => {
    expect(sourceCodeUrl('https://github.com/o/r', SHA)).toBe(`https://github.com/o/r/tree/${SHA}`)
    expect(sourceCodeUrl('https://github.com/o/r', null)).toBe('https://github.com/o/r')
    expect(sourceCodeUrl(null, SHA)).toBeNull()
  })
})

describe('currentSourceCodeUrl', () => {
  it('applies sourceCodeUrl to the values injected by vite define', () => {
    expect(currentSourceCodeUrl()).toBe(sourceCodeUrl(__REPO_URL__, __COMMIT_SHA__))
  })
})
