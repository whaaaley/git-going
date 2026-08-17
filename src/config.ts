import { dirname, join } from '@std/path'
import { scopePattern, typePattern } from './commit.pattern.ts'
import { safe } from './utils/safe.utils.ts'

// Reads git-going.json from the repository root, found by walking up from the working directory.
// Every field defaults, so a project with no config file behaves exactly as the defaults describe.

export type Tier = {
  name: string
  files: number
  lines: number
}

export type UncommittedConfig = {
  files: number
  lines: number
}

export type CommitConfig = {
  types: string[]
  scopes: string[]
  maxLength: number
}

export type TreesizeConfig = {
  tiers: Tier[]
}

export type Config = {
  uncommitted: UncommittedConfig
  commit: CommitConfig
  treesize: TreesizeConfig
}

export const defaults: Config = {
  uncommitted: {
    files: 12,
    lines: 400,
  },
  commit: {
    types: [
      'feat',
      'fix',
      'refactor',
      'test',
      'docs',
      'style',
      'chore',
      'build',
      'ci',
      'perf',
      'revert',
    ],
    scopes: [],
    maxLength: 72,
  },
  treesize: {
    tiers: [
      { name: 'notice', files: 12, lines: 400 },
      { name: 'warning', files: 25, lines: 900 },
      { name: 'urgent', files: 40, lines: 1500 },
    ],
  },
}

export class ConfigError extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const rejectUnknownKeys = (source: Record<string, unknown>, allowed: string[], path: string): void => {
  for (const key of Object.keys(source)) {
    if (allowed.includes(key)) continue

    throw new ConfigError(`unknown key ${path}${key}, expected one of ${allowed.join(', ')}`)
  }
}

const readNumber = (source: Record<string, unknown>, key: string, path: string, fallback: number): number => {
  const found = source[key]

  if (found === undefined) return fallback
  if (typeof found !== 'number' || !Number.isFinite(found)) {
    throw new ConfigError(`${path}${key} must be a number`)
  }

  return found
}

const readStringArray = (source: Record<string, unknown>, key: string, path: string, fallback: string[]): string[] => {
  const found = source[key]

  if (found === undefined) return fallback
  if (!Array.isArray(found) || found.some((entry) => typeof entry !== 'string')) {
    throw new ConfigError(`${path}${key} must be an array of strings`)
  }

  return found.filter((entry): entry is string => typeof entry === 'string')
}

// A vocabulary entry the subject pattern can never match would surface later as a confusing format failure, so it is refused here by name.
const readVocabulary = (source: Record<string, unknown>, key: string, path: string, pattern: RegExp, shape: string, fallback: string[]): string[] => {
  const entries = readStringArray(source, key, path, fallback)

  for (const entry of entries) {
    if (pattern.test(entry)) continue

    throw new ConfigError(`${path}${key} entry ${JSON.stringify(entry)} is not usable, ${shape}`)
  }

  return entries
}

const readSection = (source: Record<string, unknown>, key: string, path: string): Record<string, unknown> => {
  const found = source[key]

  if (found === undefined) return {}
  if (!isObject(found)) {
    throw new ConfigError(`${path}${key} must be an object`)
  }

  return found
}

const readTiers = (source: Record<string, unknown>, path: string, fallback: Tier[]): Tier[] => {
  const found = source['tiers']

  if (found === undefined) return fallback
  if (!Array.isArray(found)) {
    throw new ConfigError(`${path}tiers must be an array`)
  }

  return found.map((entry, index): Tier => {
    const at = `${path}tiers[${index}].`

    if (!isObject(entry)) {
      throw new ConfigError(`${path}tiers[${index}] must be an object`)
    }

    rejectUnknownKeys(entry, ['name', 'files', 'lines'], at)

    const name = entry['name']

    if (typeof name !== 'string') {
      throw new ConfigError(`${at}name must be a string`)
    }

    return {
      name,
      files: readNumber(entry, 'files', at, Number.POSITIVE_INFINITY),
      lines: readNumber(entry, 'lines', at, Number.POSITIVE_INFINITY),
    }
  })
}

export const merge = (raw: unknown): Config => {
  if (raw === undefined) return defaults
  if (!isObject(raw)) {
    throw new ConfigError('git-going.json must contain a JSON object')
  }

  rejectUnknownKeys(raw, ['uncommitted', 'commit', 'treesize'], '')

  const uncommitted = readSection(raw, 'uncommitted', '')
  const commit = readSection(raw, 'commit', '')
  const treesize = readSection(raw, 'treesize', '')

  rejectUnknownKeys(uncommitted, ['files', 'lines'], 'uncommitted.')
  rejectUnknownKeys(commit, ['types', 'scopes', 'maxLength'], 'commit.')
  rejectUnknownKeys(treesize, ['tiers'], 'treesize.')

  return {
    uncommitted: {
      files: readNumber(uncommitted, 'files', 'uncommitted.', defaults.uncommitted.files),
      lines: readNumber(uncommitted, 'lines', 'uncommitted.', defaults.uncommitted.lines),
    },
    commit: {
      types: readVocabulary(commit, 'types', 'commit.', typePattern, 'a type is lowercase letters only', defaults.commit.types),
      scopes: readVocabulary(commit, 'scopes', 'commit.', scopePattern, 'a scope is lowercase letters and dashes only', defaults.commit.scopes),
      maxLength: readNumber(commit, 'maxLength', 'commit.', defaults.commit.maxLength),
    },
    treesize: {
      tiers: readTiers(treesize, 'treesize.', defaults.treesize.tiers),
    },
  }
}

export const parse = (raw: string): Config => {
  const { data: decoded, error: decodeError } = safe((): unknown => JSON.parse(raw))

  if (decodeError) throw new ConfigError('git-going.json is not valid JSON')

  return merge(decoded)
}

export const findConfigPath = (start: string): string => {
  let current = start

  while (true) {
    const candidate = join(current, 'git-going.json')

    // A missing file at this level only means the walk continues upward.
    const { data: info, error: statError } = safe(() => Deno.statSync(candidate))

    if (!statError && info.isFile) return candidate

    const parent = dirname(current)

    if (parent === current) return ''

    current = parent
  }
}

export const loadConfig = (start: string): Config => {
  const path = findConfigPath(start)

  if (path === '') return defaults

  const { data: raw, error: readError } = safe(() => Deno.readTextFileSync(path))

  if (readError) return defaults

  return parse(raw)
}
